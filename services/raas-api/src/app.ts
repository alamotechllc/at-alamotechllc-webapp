import { createHash, randomUUID } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { ApiError, newId, type Permission } from "@raas/domain";
import type { SecretWriter } from "@raas/secrets";
import type { Logger } from "@raas/logging";
import {
  assertBindingAvailable,
  authorizePermission,
  createProviderBinding,
  queryResults,
  tenantCollection,
  tenantDoc,
  tenantRoot,
  type Caller,
} from "@raas/store";

type Vars = { requestId: string; caller: Caller };

export interface ApiDeps {
  db: Firestore;
  verifyUser: (authorization: string | undefined) => Promise<Caller>;
  logger: Logger;
  projectId?: string;
  secrets: SecretWriter;
}

export function createApiApp(deps: ApiDeps): Hono<{ Variables: Vars }> {
  const app = new Hono<{ Variables: Vars }>();
  const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://127.0.0.1:5173,http://localhost:5173").split(",");
  app.use("*", cors({
    origin: (origin) => allowedOrigins.includes(origin) ? origin : "",
    allowHeaders: ["Authorization", "Content-Type", "X-Request-Id", "Idempotency-Key"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }));
  app.use("*", async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? `req_${randomUUID()}`;
    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);
    c.header("X-RaaS-Api-Version", "1");
    await next();
  });
  app.onError((err, c) => {
    const requestId = c.get("requestId") ?? "req_unknown";
    if (err instanceof SyntaxError) {
      deps.logger.write({ severity: "WARNING", message: "request failed", requestId, code: "VALIDATION_FAILED", status: 400 });
      return c.json({ error: { code: "VALIDATION_FAILED", message: "Malformed JSON.", requestId, details: [] } }, 400);
    }
    if (err instanceof ApiError) {
      deps.logger.write({ severity: "WARNING", message: "request failed", requestId, code: err.code, status: err.status });
      return c.json({ error: { code: err.code, message: err.message, requestId, details: err.details } }, errorStatus(err.status));
    }
    deps.logger.write({ severity: "ERROR", message: "unexpected error", requestId, name: err instanceof Error ? err.name : "Error" });
    return c.json({ error: { code: "INTERNAL", message: "Unexpected error.", requestId, details: [] } }, 500);
  });

  app.get("/healthz", (c) => c.json({ ok: true }));

  app.get("/v1/session", async (c) => {
    const caller = await deps.verifyUser(c.req.header("authorization"));
    c.set("caller", caller);
    return c.json({
      authorized: true,
      role: caller.raasRole,
      ...(caller.tenantId ? { tenantId: caller.tenantId } : {}),
    });
  });

  app.get("/v1/tenants/:tenantId", async (c) => {
    const caller = await open(c, deps, "tenant.read");
    const tenantId = c.req.param("tenantId");
    const snap = await tenantRoot(deps.db, tenantId).get();
    if (!snap.exists) throw new ApiError(404, "NOT_FOUND", "Tenant was not found.");
    const data = snap.data() ?? {};
    deps.logger.write({ severity: "INFO", message: "tenant read", requestId: c.get("requestId"), tenantId, actorUid: caller.uid });
    return c.json({
      tenantId: data.tenantId,
      legalName: data.legalName,
      status: data.status,
      timezone: data.timezone,
    });
  });

  app.get("/v1/tenants/:tenantId/service-instances", async (c) => {
    const caller = await open(c, deps, "tenant.read");
    const tenantId = c.req.param("tenantId");
    const snap = await tenantCollection(deps.db, tenantId, "serviceInstances").get();
    deps.logger.write({ severity: "INFO", message: "service instances read", requestId: c.get("requestId"), tenantId, actorUid: caller.uid });
    return c.json({
      items: snap.docs.map((doc) => {
        const data = doc.data();
        return {
          instanceId: data.instanceId,
          productCode: data.productCode,
          status: data.status,
          metricPolicyVersion: data.metricPolicyVersion,
        };
      }),
      nextPageToken: null,
    });
  });

  app.post("/v1/tenants/:tenantId/provider-bindings", async (c) => {
    const caller = await open(c, deps, "providerBinding.manage");
    const tenantId = c.req.param("tenantId");
    const idempotencyKey = c.req.header("idempotency-key");
    if (!idempotencyKey) throw new ApiError(400, "VALIDATION_FAILED", "Idempotency-Key is required.");
    const body = await c.req.json<Record<string, unknown>>();
    const secretValue = typeof body.secretValue === "string" ? body.secretValue : "";
    const publicBody = { ...body };
    delete publicBody.secretValue;
    const requestHash = createHash("sha256").update(JSON.stringify(publicBody)).digest("hex");
    const idemRef = tenantDoc(deps.db, tenantId, "idempotency", idempotencyKey);
    const prior = await idemRef.get();
    if (prior.exists) {
      if (prior.data()?.requestHash !== requestHash) {
        throw new ApiError(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key was reused with a different body.");
      }
      return c.json(bindingView(caller, prior.data()?.response), 200);
    }
    if (!secretValue) {
      throw new ApiError(422, "VALIDATION_FAILED", "secretValue is required.", [{ field: "secretValue", issue: "required" }]);
    }
    if (body.reconcileMode !== undefined && body.reconcileMode !== "webhook_only") {
      throw new ApiError(422, "VALIDATION_FAILED", "Milestone 1 records reconcileMode webhook_only.", [
        { field: "reconcileMode", issue: "unsupported" },
      ]);
    }
    const provider = String(body.provider ?? "");
    const externalAccountId = String(body.externalAccountId ?? "");
    await assertBindingAvailable(deps.db, provider, externalAccountId);
    const bindingId = newId("bnd");
    const added = await deps.secrets.addVersion(`raas-local-binding-${bindingId.toLowerCase()}`, secretValue);
    const providerConfig = readProviderConfig(body.providerConfig);
    const created = await createProviderBinding(deps.db, {
      tenantId,
      bindingId,
      serviceInstanceId: String(body.serviceInstanceId ?? ""),
      channel: body.channel as "calendar",
      provider,
      externalAccountId,
      secretResource: added.secretResource,
      reconcileMode: "webhook_only",
      ...(providerConfig ? { providerConfig } : {}),
      actorUid: caller.uid,
      actorRole: caller.raasRole ?? "operator",
      requestId: c.get("requestId"),
    });
    const response = bindingView(caller, {
      bindingId: created.bindingId,
      tenantId,
      serviceInstanceId: body.serviceInstanceId,
      provider: body.provider,
      externalAccountId: body.externalAccountId,
      channel: body.channel,
      status: "active",
      reconcileMode: "webhook_only",
      secretPresent: true,
      secretResource: added.secretResource,
    });
    await idemRef.set({ requestHash, response, createdAt: FieldValue.serverTimestamp() });
    deps.logger.write({
      severity: "INFO",
      message: "binding created",
      requestId: c.get("requestId"),
      tenantId,
      bindingId: created.bindingId,
      provider: body.provider,
      actorUid: caller.uid,
    });
    return c.json(response, 201);
  });

  app.get("/v1/tenants/:tenantId/provider-bindings", async (c) => {
    const caller = await open(c, deps, "providerBinding.read");
    const tenantId = c.req.param("tenantId");
    const snap = await tenantCollection(deps.db, tenantId, "providerBindings").get();
    return c.json({
      items: snap.docs.map((doc) => {
        const data = doc.data();
        return {
          bindingId: data.bindingId,
          provider: data.provider,
          externalAccountId: data.externalAccountId,
          channel: data.channel,
          status: data.status,
          serviceInstanceId: data.serviceInstanceId,
          reconcileMode: data.reconcileMode ?? "webhook_only",
          ...(caller.raasRole === "platform_admin" ? { secretResource: data.secretResource } : { secretPresent: true }),
        };
      }),
      nextPageToken: null,
    });
  });

  app.get("/v1/tenants/:tenantId/appointments", async (c) => {
    await open(c, deps, "appointment.read");
    const tenantId = c.req.param("tenantId");
    const snap = await tenantCollection(deps.db, tenantId, "appointments").limit(50).get();
    return c.json({
      items: snap.docs.map((doc) => ({
        appointmentId: doc.id,
        status: doc.data().status,
        provider: doc.data().provider,
        providerAppointmentId: doc.data().providerAppointmentId,
        serviceInstanceId: doc.data().serviceInstanceId,
        startAt: timestampToIso(doc.data().startAt),
        endAt: timestampToIso(doc.data().endAt),
        timezone: doc.data().timezone,
      })),
      nextPageToken: null,
    });
  });

  app.get("/v1/tenants/:tenantId/events", async (c) => {
    await open(c, deps, "appointment.read");
    const tenantId = c.req.param("tenantId");
    const snap = await tenantCollection(deps.db, tenantId, "businessEvents").orderBy("recordedAt", "desc").limit(50).get();
    return c.json({
      items: snap.docs.map((doc) => ({
        eventId: doc.id,
        eventType: doc.data().eventType,
        occurredAt: timestampToIso(doc.data().occurredAt),
        recordedAt: timestampToIso(doc.data().recordedAt),
        serviceInstanceId: doc.data().serviceInstanceId,
      })),
      nextPageToken: null,
    });
  });

  app.get("/v1/tenants/:tenantId/results", async (c) => {
    const caller = await open(c, deps, "result.read");
    const tenantId = c.req.param("tenantId");
    const serviceInstanceId = c.req.query("serviceInstanceId");
    const from = c.req.query("from");
    const to = c.req.query("to");
    if (!serviceInstanceId || !from || !to) {
      throw new ApiError(400, "VALIDATION_FAILED", "serviceInstanceId, from, and to are required.");
    }
    const result = await queryResults(deps.db, tenantId, serviceInstanceId, from, to);
    deps.logger.write({
      severity: "INFO",
      message: "results read",
      requestId: c.get("requestId"),
      tenantId,
      serviceInstanceId,
      actorUid: caller.uid,
    });
    return c.json(result);
  });

  return app;
}

async function open(
  c: { req: { header: (name: string) => string | undefined; param: (name: string) => string }; set: (key: "caller", value: Caller) => void; get: (key: "requestId") => string },
  deps: ApiDeps,
  permission: Permission,
): Promise<Caller> {
  const caller = await deps.verifyUser(c.req.header("authorization"));
  c.set("caller", caller);
  await authorizePermission(deps.db, caller, c.req.param("tenantId"), permission);
  return caller;
}

function bindingView(caller: Caller, response: unknown): Record<string, unknown> {
  const view = response && typeof response === "object" ? { ...(response as Record<string, unknown>) } : {};
  if (caller.raasRole !== "platform_admin") delete view.secretResource;
  return view;
}

function readProviderConfig(value: unknown): { calendarId: string } | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(422, "VALIDATION_FAILED", "providerConfig is invalid.", [{ field: "providerConfig", issue: "invalid" }]);
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "calendarId") {
      throw new ApiError(422, "VALIDATION_FAILED", "providerConfig contains an unsupported field.", [
        { field: `providerConfig.${key}`, issue: "unknown" },
      ]);
    }
  }
  if (typeof record.calendarId !== "string" || record.calendarId.trim() === "" || record.calendarId.length > 200) {
    throw new ApiError(422, "VALIDATION_FAILED", "calendarId is invalid.", [{ field: "providerConfig.calendarId", issue: "invalid" }]);
  }
  return { calendarId: record.calendarId };
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return "";
}

function errorStatus(status: number): 400 | 401 | 403 | 404 | 409 | 422 | 500 {
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 409 || status === 422) return status;
  return 500;
}
