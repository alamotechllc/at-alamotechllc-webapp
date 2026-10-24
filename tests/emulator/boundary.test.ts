import { beforeAll, describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { ApiError, DEFAULT_RETENTION, TENANT_ZERO } from "@raas/domain";
import { MemoryLogger } from "@raas/logging";
import { MemorySecretStore } from "@raas/secrets";
import {
  auth,
  countTenantAppointments,
  createProviderBinding,
  firestore,
  ingestEvent,
  seedTenantZero,
  tenantCollection,
  tenantDoc,
  tenantRoot,
} from "@raas/store";
import { createApiApp } from "../../services/raas-api/src/app.js";
import { callerFromAuthorization } from "../../services/raas-api/src/identity.js";
import { createIngressApp } from "../../services/raas-ingress/src/app.js";

const TENANT_B = "ten_boundary_other";
const WINDOW = "from=2026-10-01T00:00:00.000Z&to=2026-11-01T00:00:00.000Z";
const ingressEnv = {
  OIDC_MODE: "local",
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8280",
  LOCAL_INGRESS_TOKEN: "local-test",
  LOCAL_ADAPTER_EMAIL: "raas-adapter@local.test",
  LOCAL_ADAPTER_PROVIDERS: "gohighlevel",
};

const booked = {
  eventType: "AppointmentBooked",
  occurredAt: "2026-10-23T18:04:05.000Z",
  occurredAtSource: "provider" as const,
  correlationId: "appt_stop_001",
  source: {
    provider: "gohighlevel",
    providerEventId: "appt_stop_001",
    providerAccountId: "loc_stop_001",
  },
  attributes: {
    providerAppointmentId: "appt_stop_001",
    startAt: "2026-10-24T15:00:00.000Z",
    endAt: "2026-10-24T15:30:00.000Z",
    timezone: "America/Chicago",
  },
};

async function idToken(uid: string, claims: Record<string, unknown>, email: string): Promise<string> {
  try {
    await auth().createUser({ uid, email, emailVerified: true });
  } catch {
    await auth().updateUser(uid, { email, emailVerified: true });
  }
  await auth().setCustomUserClaims(uid, claims);
  const custom = await auth().createCustomToken(uid, claims);
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9198";
  const response = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    },
  );
  const json = (await response.json()) as { idToken?: string };
  if (!json.idToken) throw new Error(`Auth emulator did not return a token (${response.status}).`);
  return json.idToken;
}

describe("trusted backend boundary", () => {
  const db = firestore();
  const logger = new MemoryLogger();
  const ingress = createIngressApp({ db, logger, env: ingressEnv });
  const api = createApiApp({
    db,
    logger,
    verifyUser: callerFromAuthorization,
    projectId: "demo-raas-cp",
    secrets: new MemorySecretStore("demo-raas-cp"),
  });
  let adminToken = "";
  let operatorToken = "";

  beforeAll(async () => {
    await seedTenantZero(db, {
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8280",
      FIREBASE_PROJECT_ID: "demo-raas-cp",
    });
    await tenantRoot(db, TENANT_B).set({
      tenantId: TENANT_B,
      legalName: "Other Fixture LLC",
      status: "active",
      createdAt: Timestamp.now(),
      createdByUid: "seed",
      timezone: "America/Chicago",
      retention: DEFAULT_RETENTION,
    });
    await tenantDoc(db, TENANT_B, "appointments", "apt_other").set({
      appointmentId: "apt_other",
      tenantId: TENANT_B,
      serviceInstanceId: "ins_other",
      status: "booked",
      provider: "gohighlevel",
      providerAppointmentId: "appt_other_only",
      bookedEventId: "evt_other",
      startAt: Timestamp.now(),
      endAt: Timestamp.now(),
      timezone: "America/Chicago",
    });
    await db.doc("operators/operator-b").set({
      platformRole: "operator",
      status: "active",
      hostedDomain: "alamotechllc.com",
    });
    await db.doc(`operators/operator-b/assignments/${TENANT_B}`).set({
      tenantId: TENANT_B,
      grantedByUid: "seed",
      grantedAt: Timestamp.now(),
    });
    try {
      await createProviderBinding(db, {
        tenantId: TENANT_ZERO.tenantId,
        serviceInstanceId: TENANT_ZERO.instanceId,
        channel: "calendar",
        provider: "gohighlevel",
        externalAccountId: "loc_stop_001",
        secretResource: "projects/demo-raas-cp/secrets/raas-binding-stop",
        actorUid: "seed",
        actorRole: "platform_admin",
        requestId: "boundary",
      });
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "DUPLICATE_BINDING") throw error;
    }
    for (const collection of ["businessEvents", "appointments", "leads"] as const) {
      const snap = await tenantCollection(db, TENANT_ZERO.tenantId, collection).get();
      for (const doc of snap.docs) await doc.ref.delete();
    }
    await db.doc("platformAdmins/platform-admin").set({
      uid: "platform-admin",
      email: "admin@alamotechllc.test",
      status: "active",
    });
    adminToken = await idToken("platform-admin", { raasRole: "platform_admin" }, "admin@alamotechllc.test");
    operatorToken = await idToken("operator-b", { raasRole: "operator" }, "operator-b@alamotechllc.test");
  });

  it("rejects unauthenticated API and ingress callers", async () => {
    const apiDenied = await api.request(`/v1/tenants/${TENANT_ZERO.tenantId}`, { headers: { "x-request-id": "req_api_auth" } });
    expect(apiDenied.status).toBe(401);
    const ingressDenied = await ingress.request("/v1/ingress/events", {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "req_ingress_auth" },
      body: JSON.stringify(booked),
    });
    expect(ingressDenied.status).toBe(401);
    expect(logger.serialized()).not.toContain("local-test");
  });

  it("rejects an adapter that is not allowed for the provider", async () => {
    const response = await ingress.request("/v1/ingress/events", {
      method: "POST",
      headers: { authorization: "Bearer local-test", "content-type": "application/json" },
      body: JSON.stringify({ ...booked, source: { ...booked.source, provider: "other-vendor" } }),
    });
    expect(response.status).toBe(403);
  });

  it("rejects an unknown account and a tenant that disagrees with the binding", async () => {
    const unknown = await ingress.request("/v1/ingress/events", {
      method: "POST",
      headers: { authorization: "Bearer local-test", "content-type": "application/json" },
      body: JSON.stringify({
        ...booked,
        source: { ...booked.source, providerAccountId: "loc_missing" },
      }),
    });
    expect(unknown.status).toBe(404);
    expect(((await unknown.json()) as { error: { code: string } }).error.code).toBe("BINDING_UNKNOWN");

    const mismatch = await ingress.request("/v1/ingress/events", {
      method: "POST",
      headers: { authorization: "Bearer local-test", "content-type": "application/json" },
      body: JSON.stringify({ ...booked, tenantId: TENANT_B }),
    });
    expect(mismatch.status).toBe(422);
    expect(((await mismatch.json()) as { error: { code: string } }).error.code).toBe("TENANT_MISMATCH");
  });

  it("resolves Tenant Zero from the binding when the body omits tenantId", async () => {
    const created = await ingress.request("/v1/ingress/events", {
      method: "POST",
      headers: { authorization: "Bearer local-test", "content-type": "application/json", "x-request-id": "req_create" },
      body: JSON.stringify({
        ...booked,
        email: "ada.fixture@example.com",
        phone: "+15555550100",
        inlineBase64: "raw-webhook",
      }),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { replayed: boolean; eventId: string };
    expect(createdBody.replayed).toBe(false);
    const stored = await tenantDoc(db, TENANT_ZERO.tenantId, "businessEvents", createdBody.eventId).get();
    expect(stored.exists).toBe(true);
    expect(stored.data()?.tenantId).toBe(TENANT_ZERO.tenantId);
    expect(await countTenantAppointments(db, TENANT_ZERO.tenantId)).toBe(1);

    const replay = await ingress.request("/v1/ingress/events", {
      method: "POST",
      headers: { authorization: "Bearer local-test", "content-type": "application/json" },
      body: JSON.stringify(booked),
    });
    expect(replay.status).toBe(200);
    expect(((await replay.json()) as { replayed: boolean }).replayed).toBe(true);
    expect(await countTenantAppointments(db, TENANT_ZERO.tenantId)).toBe(1);

    const conflict = await ingress.request("/v1/ingress/events", {
      method: "POST",
      headers: { authorization: "Bearer local-test", "content-type": "application/json" },
      body: JSON.stringify({
        ...booked,
        attributes: { ...booked.attributes, endAt: "2026-10-24T16:00:00.000Z" },
      }),
    });
    expect(conflict.status).toBe(409);
    const conflictBody = (await conflict.json()) as { error: { code: string } };
    expect(conflictBody.error.code).toBe("IDEMPOTENCY_CONFLICT");
    const after = await tenantDoc(db, TENANT_ZERO.tenantId, "businessEvents", createdBody.eventId).get();
    expect(after.data()?.attributes.endAt).toBe("2026-10-24T15:30:00.000Z");
    expect(await countTenantAppointments(db, TENANT_ZERO.tenantId)).toBe(1);
    const results = await api.request(
      `/v1/tenants/${TENANT_ZERO.tenantId}/results?serviceInstanceId=${TENANT_ZERO.instanceId}&${WINDOW}`,
      { headers: { authorization: `Bearer ${adminToken}` } },
    );
    expect(results.status).toBe(200);
    const resultsBody = (await results.json()) as { metrics: { appointmentsBooked: { value: number } } };
    expect(resultsBody.metrics.appointmentsBooked.value).toBe(1);
    expect(logger.serialized()).not.toContain("ada.fixture@example.com");
    expect(logger.serialized()).not.toContain("+15555550100");
    expect(logger.serialized()).not.toContain("raw-webhook");
  });

  it("keeps one appointment when the same event is submitted concurrently", async () => {
    const parallel = {
      ...booked,
      correlationId: "appt_stop_parallel",
      source: { ...booked.source, providerEventId: "appt_stop_parallel" },
      attributes: { ...booked.attributes, providerAppointmentId: "appt_stop_parallel" },
    };
    const results = await Promise.allSettled([ingestEvent(db, parallel), ingestEvent(db, parallel)]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    expect(fulfilled).toHaveLength(2);
    const appointments = await tenantCollection(db, TENANT_ZERO.tenantId, "appointments").get();
    expect(appointments.docs.filter((doc) => doc.data().providerAppointmentId === "appt_stop_parallel")).toHaveLength(1);
  });

  it("does not let an operator of tenant B read Tenant Zero", async () => {
    const denied = await api.request(`/v1/tenants/${TENANT_ZERO.tenantId}`, {
      headers: { authorization: `Bearer ${operatorToken}` },
    });
    expect(denied.status).toBe(403);
    const own = await api.request(`/v1/tenants/${TENANT_B}/appointments`, {
      headers: { authorization: `Bearer ${operatorToken}` },
    });
    expect(own.status).toBe(200);
    const ownBody = (await own.json()) as { items: { providerAppointmentId: string }[] };
    expect(ownBody.items.map((item) => item.providerAppointmentId)).toContain("appt_other_only");

    const adminAppointments = await api.request(`/v1/tenants/${TENANT_ZERO.tenantId}/appointments`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(adminAppointments.status).toBe(200);
    const adminBody = (await adminAppointments.json()) as { items: { providerAppointmentId: string }[] };
    expect(adminBody.items.map((item) => item.providerAppointmentId)).not.toContain("appt_other_only");

  });

  it("configures a binding without storing the secret value", async () => {
    const response = await api.request(`/v1/tenants/${TENANT_ZERO.tenantId}/provider-bindings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
        "idempotency-key": "boundary-binding-1",
      },
      body: JSON.stringify({
        serviceInstanceId: TENANT_ZERO.instanceId,
        channel: "calendar",
        provider: "gohighlevel",
        externalAccountId: "loc_configured_001",
        secretValue: "super-secret-value",
      }),
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as { bindingId: string; secretPresent: boolean; secretValue?: string };
    expect(body.secretPresent).toBe(true);
    expect(body.secretValue).toBeUndefined();
    const stored = await tenantDoc(db, TENANT_ZERO.tenantId, "providerBindings", body.bindingId).get();
    expect(stored.data()?.secretValue).toBeUndefined();
    expect(logger.serialized()).not.toContain("super-secret-value");
    const listed = await api.request(`/v1/tenants/${TENANT_ZERO.tenantId}/service-instances`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(listed.status).toBe(200);
    const events = await api.request(`/v1/tenants/${TENANT_ZERO.tenantId}/events`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(events.status).toBe(200);
    const eventBody = (await events.json()) as { items: { eventType: string }[] };
    expect(eventBody.items.some((item) => item.eventType === "AppointmentBooked")).toBe(true);
  });

  it("rejects an adapter bearer and malformed JSON as client errors", async () => {
    const adapterOnApi = await api.request(`/v1/tenants/${TENANT_ZERO.tenantId}`, {
      headers: { authorization: "Bearer not-a-firebase-id-token" },
    });
    expect(adapterOnApi.status).toBe(401);
    expect(((await adapterOnApi.json()) as { error: { code: string } }).error.code).toBe("UNAUTHENTICATED");

    const malformed = await api.request(`/v1/tenants/${TENANT_ZERO.tenantId}/provider-bindings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
        "idempotency-key": "boundary-malformed",
      },
      body: "{",
    });
    expect(malformed.status).toBe(400);
    expect(((await malformed.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_FAILED");
  });

  it("does not return secretResource when an operator replays an admin binding create", async () => {
    await db.doc("operators/operator-boundary-a").set({ status: "active" });
    await db.doc(`operators/operator-boundary-a/assignments/${TENANT_ZERO.tenantId}`).set({
      tenantId: TENANT_ZERO.tenantId,
      grantedAt: Timestamp.now(),
    });
    const operator = await idToken("operator-boundary-a", { raasRole: "operator" }, "operator-a@alamotechllc.test");
    const account = `loc_boundary_replay_${Date.now()}`;
    const payload = {
      serviceInstanceId: TENANT_ZERO.instanceId,
      channel: "calendar",
      provider: "gohighlevel",
      externalAccountId: account,
      secretValue: "boundary-secret-value",
    };
    const created = await api.request(`/v1/tenants/${TENANT_ZERO.tenantId}/provider-bindings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
        "idempotency-key": `boundary-replay-${account}`,
      },
      body: JSON.stringify(payload),
    });
    expect(created.status).toBe(201);
    const replay = await api.request(`/v1/tenants/${TENANT_ZERO.tenantId}/provider-bindings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${operator}`,
        "content-type": "application/json",
        "idempotency-key": `boundary-replay-${account}`,
      },
      body: JSON.stringify(payload),
    });
    expect(replay.status).toBe(200);
    const body = (await replay.json()) as { secretResource?: string; secretPresent?: boolean; secretValue?: string };
    expect(body.secretPresent).toBe(true);
    expect(body.secretResource).toBeUndefined();
    expect(body.secretValue).toBeUndefined();
    expect(logger.serialized()).not.toContain("boundary-secret-value");
  });
});
