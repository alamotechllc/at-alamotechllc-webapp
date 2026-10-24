import { beforeAll, describe, expect, it } from "vitest";
import { ApiError, TENANT_ZERO } from "@raas/domain";
import { MemoryLogger } from "@raas/logging";
import { MemorySecretStore } from "@raas/secrets";
import {
  authorizeTenantRead,
  createProviderBinding,
  firestore,
  ingestEvent,
  queryResults,
  seedTenantZero,
} from "@raas/store";
import { createApiApp } from "../../services/raas-api/src/app.js";
import { createIngressApp } from "../../services/raas-ingress/src/app.js";

const env = {
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8280",
  FIREBASE_PROJECT_ID: "demo-raas-cp",
};

const appointment = {
  eventType: "AppointmentBooked",
  occurredAt: "2026-10-23T18:04:05.000Z",
  occurredAtSource: "provider" as const,
  correlationId: "appt_fixture_001",
  source: {
    provider: "gohighlevel",
    providerEventId: "appt_fixture_001",
    providerAccountId: "loc_fixture_001",
  },
  attributes: {
    providerAppointmentId: "appt_fixture_001",
    startAt: "2026-10-24T15:00:00.000Z",
    endAt: "2026-10-24T15:30:00.000Z",
    timezone: "America/Chicago",
  },
};

describe("Tenant Zero foundation", () => {
  const db = firestore();

  beforeAll(async () => {
    await seedTenantZero(db, env);
    await createProviderBinding(db, {
      tenantId: TENANT_ZERO.tenantId,
      serviceInstanceId: TENANT_ZERO.instanceId,
      channel: "calendar",
      provider: "gohighlevel",
      externalAccountId: "loc_fixture_001",
      secretResource: "projects/demo-raas-cp/secrets/raas-binding-fixture",
      actorUid: "seed",
      actorRole: "platform_admin",
      requestId: "seed",
    });
  });

  it("seeds Alamo Tech with the shared tenant model", async () => {
    const tenant = await db.doc(`tenants/${TENANT_ZERO.tenantId}`).get();
    const instance = await db.doc(`tenants/${TENANT_ZERO.tenantId}/serviceInstances/${TENANT_ZERO.instanceId}`).get();
    expect(tenant.data()?.legalName).toBe("Alamo Tech LLC");
    expect(tenant.data()?.status).toBe("active");
    expect(instance.data()?.productCode).toBe("lead-capture");
    expect(instance.data()?.metricPolicyVersion).toBe("lead-capture-metrics-v1");
    const audits = await db.collection(`tenants/${TENANT_ZERO.tenantId}/auditEvents`).get();
    expect(audits.docs.some((doc) => doc.data().action === "tenant.create")).toBe(true);
  });

  it("ingests AppointmentBooked once, replays, and counts it", async () => {
    const before = await queryResults(
      db,
      TENANT_ZERO.tenantId,
      TENANT_ZERO.instanceId,
      "2026-10-01T00:00:00.000Z",
      "2026-11-01T00:00:00.000Z",
    );
    const created = await ingestEvent(db, appointment);
    expect(created.replayed).toBe(false);
    expect(created.tenantId).toBe(TENANT_ZERO.tenantId);
    const replay = await ingestEvent(db, appointment);
    expect(replay.replayed).toBe(true);
    expect(replay.eventId).toBe(created.eventId);

    await expect(
      ingestEvent(db, {
        ...appointment,
        attributes: { ...appointment.attributes, endAt: "2026-10-24T16:00:00.000Z" },
      }),
    ).rejects.toBeInstanceOf(ApiError);

    const results = await queryResults(
      db,
      TENANT_ZERO.tenantId,
      TENANT_ZERO.instanceId,
      "2026-10-01T00:00:00.000Z",
      "2026-11-01T00:00:00.000Z",
    );
    expect(results.metrics.appointmentsBooked.value).toBe((before.metrics.appointmentsBooked.value ?? 0) + 1);
  });

  it("uses the same authorization path for Tenant Zero and any other tenant", async () => {
    await db.doc("platformAdmins/admin").set({ uid: "admin", email: "admin@alamotechllc.test", status: "active" });
    await authorizeTenantRead(db, { uid: "admin", raasRole: "platform_admin", email: "admin@alamotechllc.test", signInProvider: "custom" }, TENANT_ZERO.tenantId);
    await expect(
      authorizeTenantRead(db, { uid: "viewer", raasRole: "tenant_viewer", tenantId: "ten_other" }, TENANT_ZERO.tenantId),
    ).rejects.toMatchObject({ code: "TENANT_FORBIDDEN" });
  });

  it("serves the event through local ingress and the results API", async () => {
    const logger = new MemoryLogger();
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
    const denied = await ingress.request("/v1/ingress/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...appointment, source: { ...appointment.source, providerEventId: "appt_fixture_002" }, correlationId: "appt_fixture_002", attributes: { ...appointment.attributes, providerAppointmentId: "appt_fixture_002" } }),
    });
    expect(denied.status).toBe(401);
    const beforeHttp = await queryResults(
      db,
      TENANT_ZERO.tenantId,
      TENANT_ZERO.instanceId,
      "2026-10-01T00:00:00.000Z",
      "2026-11-01T00:00:00.000Z",
    );

    const accepted = await ingress.request("/v1/ingress/events", {
      method: "POST",
      headers: { authorization: "Bearer local-test", "content-type": "application/json" },
      body: JSON.stringify({
        ...appointment,
        correlationId: "appt_fixture_002",
        source: { ...appointment.source, providerEventId: "appt_fixture_002" },
        attributes: { ...appointment.attributes, providerAppointmentId: "appt_fixture_002" },
      }),
    });
    expect(accepted.status).toBe(201);

    await db.doc("platformAdmins/admin").set({ uid: "admin", email: "admin@alamotechllc.test", status: "active" });
    const api = createApiApp({
      db,
      logger,
      secrets: new MemorySecretStore("demo-raas-cp"),
      verifyUser: async (authorization) => {
        if (authorization !== "Bearer user-test") {
          throw new ApiError(401, "UNAUTHENTICATED", "A Firebase ID token is required.");
        }
        return { uid: "admin", raasRole: "platform_admin", email: "admin@alamotechllc.test", signInProvider: "custom" };
      },
    });
    const response = await api.request(
      `/v1/tenants/${TENANT_ZERO.tenantId}/results?serviceInstanceId=${TENANT_ZERO.instanceId}&from=2026-10-01T00:00:00.000Z&to=2026-11-01T00:00:00.000Z`,
      { headers: { authorization: "Bearer user-test" } },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { metrics: { appointmentsBooked: { value: number } } };
    expect(body.metrics.appointmentsBooked.value).toBe((beforeHttp.metrics.appointmentsBooked.value ?? 0) + 1);
    expect(logger.serialized()).not.toContain("local-test");
  });
});
