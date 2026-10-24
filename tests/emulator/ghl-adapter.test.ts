import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ApiError, TENANT_ZERO } from "@raas/domain";
import { MemoryLogger } from "@raas/logging";
import { MemorySecretStore } from "@raas/secrets";
import { firestore, queryResults, seedTenantZero, tenantCollection, tenantDoc } from "@raas/store";
import { createApiApp } from "../../services/raas-api/src/app.js";
import { createGhlAdapterApp } from "../../services/ghl-adapter/src/app.js";
import { createHttpIngressClient, honoFetch } from "../../services/ghl-adapter/src/ingressClient.js";
import { signProviderBody } from "../../services/ghl-adapter/src/signature.js";
import { createIngressApp } from "../../services/raas-ingress/src/app.js";

const fixtureDir = path.join(process.cwd(), "services/ghl-adapter/fixtures");
const signingSecret = "fixture-signing-secret-not-a-credential";
const account = "loc_tenant_zero_fixture";
const window = "from=2026-10-01T00:00:00.000Z&to=2026-11-01T00:00:00.000Z";

function fixture(name: string): string {
  return readFileSync(path.join(fixtureDir, name), "utf8");
}

describe("GoHighLevel AppointmentBooked", () => {
  const db = firestore();
  const logger = new MemoryLogger();
  const secrets = new MemorySecretStore("demo-raas-cp");
  const ingress = createIngressApp({
    db,
    logger,
    env: {
      OIDC_MODE: "local",
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8280",
      LOCAL_INGRESS_TOKEN: "local-test",
      LOCAL_ADAPTER_PROVIDERS: "gohighlevel",
    },
  });
  const ingressCalls: number[] = [];
  const client = createHttpIngressClient({
    fetchImpl: honoFetch(ingress),
    origin: "http://ingress.local",
    authorization: "Bearer local-test",
  });
  const adapter = createGhlAdapterApp({
    ingress: {
      resolveBinding: (provider, externalAccountId) => client.resolveBinding(provider, externalAccountId),
      submitEvent: async (event) => {
        const result = await client.submitEvent(event);
        ingressCalls.push(result.status);
        return result;
      },
    },
    secrets,
    logger,
    retryDelayMs: () => 0,
  });
  const api = createApiApp({
    db,
    logger,
    secrets,
    projectId: "demo-raas-cp",
    verifyUser: async (authorization) => {
      if (authorization !== "Bearer user-test") {
        throw new ApiError(401, "UNAUTHENTICATED", "A Firebase ID token is required.");
      }
      return { uid: "admin", raasRole: "platform_admin", email: "admin@alamotechllc.test", signInProvider: "custom" };
    },
  });

  beforeAll(async () => {
    await db.doc("platformAdmins/admin").set({ uid: "admin", email: "admin@alamotechllc.test", status: "active" });
    await seedTenantZero(db, {
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8280",
      FIREBASE_PROJECT_ID: "demo-raas-cp",
    });
    const createdBinding = await api.request(`/v1/tenants/${TENANT_ZERO.tenantId}/provider-bindings`, {
      method: "POST",
      headers: {
        authorization: "Bearer user-test",
        "content-type": "application/json",
        "idempotency-key": "ghl-fixture-binding",
      },
      body: JSON.stringify({
        serviceInstanceId: TENANT_ZERO.instanceId,
        channel: "calendar",
        provider: "gohighlevel",
        externalAccountId: account,
        secretValue: signingSecret,
        providerConfig: { calendarId: "cal_fixture_001" },
      }),
    });
    expect(createdBinding.status).toBe(201);
    const bindingBody = (await createdBinding.json()) as { bindingId: string; secretValue?: string };
    expect(bindingBody.secretValue).toBeUndefined();
    const storedBinding = await tenantDoc(db, TENANT_ZERO.tenantId, "providerBindings", bindingBody.bindingId).get();
    expect(JSON.stringify(storedBinding.data())).not.toContain(signingSecret);
    expect(storedBinding.data()?.reconcileMode).toBe("webhook_only");
    expect(secrets.addedSecretIds.some((id) => id.startsWith("raas-local-binding-"))).toBe(true);
  });

  async function post(name: string, accountId = account): Promise<Response> {
    const raw = fixture(name);
    return adapter.request(`/webhooks/gohighlevel/${accountId}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-provider-signature": signProviderBody(signingSecret, raw),
      },
      body: raw,
    });
  }

  it("rejects unknown, malformed, and incomplete bookings before ingress", async () => {
    const unknown = await post("appointment-unknown-binding.json", "loc_unknown_fixture");
    expect(unknown.status).toBe(401);
    const malformed = await post("appointment-malformed.json");
    expect(malformed.status).toBe(400);
    const missing = await post("appointment-missing-required.json");
    expect(missing.status).toBe(422);
    expect(ingressCalls).toHaveLength(0);
  });

  it("books Tenant Zero once, replays, and rejects a conflicting payload", async () => {
    for (const collection of ["businessEvents", "appointments", "leads"] as const) {
      const snap = await tenantCollection(db, TENANT_ZERO.tenantId, collection).get();
      for (const doc of snap.docs) await doc.ref.delete();
    }
    const created = await post("appointment-booked.json");
    expect(created.status).toBe(200);
    expect(((await created.json()) as { replayed: boolean }).replayed).toBe(false);
    expect(ingressCalls.at(-1)).toBe(201);

    const results = await api.request(
      `/v1/tenants/${TENANT_ZERO.tenantId}/results?serviceInstanceId=${TENANT_ZERO.instanceId}&${window}`,
      { headers: { authorization: "Bearer user-test" } },
    );
    expect(results.status).toBe(200);
    const resultsBody = (await results.json()) as { metrics: { appointmentsBooked: { value: number } } };
    expect(resultsBody.metrics.appointmentsBooked.value).toBe(1);
    const direct = await queryResults(db, TENANT_ZERO.tenantId, TENANT_ZERO.instanceId, "2026-10-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z");
    expect(direct.metrics.appointmentsBooked.value).toBe(1);

    const replay = await post("appointment-booked-replay.json");
    expect(replay.status).toBe(200);
    expect(((await replay.json()) as { replayed: boolean }).replayed).toBe(true);
    expect(ingressCalls.at(-1)).toBe(200);
    expect(direct.metrics.appointmentsBooked.value).toBe(1);
    const afterReplay = await queryResults(db, TENANT_ZERO.tenantId, TENANT_ZERO.instanceId, "2026-10-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z");
    expect(afterReplay.metrics.appointmentsBooked.value).toBe(1);

    const conflict = await post("appointment-conflict.json");
    expect(conflict.status).toBe(200);
    const conflictBody = (await conflict.json()) as { code: string; ingressStatus: number };
    expect(conflictBody.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(conflictBody.ingressStatus).toBe(409);
    expect(ingressCalls.at(-1)).toBe(409);
    const afterConflict = await queryResults(db, TENANT_ZERO.tenantId, TENANT_ZERO.instanceId, "2026-10-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z");
    expect(afterConflict.metrics.appointmentsBooked.value).toBe(1);
    const events = await tenantCollection(db, TENANT_ZERO.tenantId, "businessEvents").get();
    expect(events.size).toBe(1);
    expect(events.docs[0]?.data().attributes.endAt).toBe("2026-10-24T15:30:00.000Z");
    expect(events.docs[0]?.data().source.provider).toBe("gohighlevel");
    expect(logger.serialized()).not.toContain(signingSecret);
    expect(logger.serialized()).not.toContain("ghl-fixture-raw-marker");
    expect(logger.serialized()).not.toContain("inlineBase64");
  });
});
