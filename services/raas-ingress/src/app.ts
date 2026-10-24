import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { authenticateLocalAdapter, authorizeAdapterProvider, type AdapterIdentity, type LocalIngressEnv } from "@raas/auth";
import { ApiError, type InboundEvent } from "@raas/domain";
import type { Logger } from "@raas/logging";
import { ingestEvent, resolveProviderBinding } from "@raas/store";

type Vars = { requestId: string };

export interface IngressDeps {
  db: Firestore;
  logger: Logger;
  env: LocalIngressEnv;
  authenticate?: (authorization: string | undefined, env: LocalIngressEnv) => AdapterIdentity;
  authorizeProvider?: (identity: AdapterIdentity, provider: string, env: LocalIngressEnv) => void;
}

export function createIngressApp(deps: IngressDeps): Hono<{ Variables: Vars }> {
  const authenticate = deps.authenticate ?? authenticateLocalAdapter;
  const authorizeProvider = deps.authorizeProvider ?? authorizeAdapterProvider;
  const app = new Hono<{ Variables: Vars }>();
  app.use("*", async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? `req_${randomUUID()}`;
    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);
    c.header("X-RaaS-Api-Version", "1");
    await next();
  });
  app.onError((err, c) => {
    const requestId = c.get("requestId") ?? "req_unknown";
    if (err instanceof ApiError) {
      deps.logger.write({ severity: "WARNING", message: "ingress rejected", requestId, code: err.code, status: err.status });
      return c.json({ error: { code: err.code, message: err.message, requestId, details: err.details } }, errorStatus(err.status));
    }
    deps.logger.write({ severity: "ERROR", message: "ingress failed", requestId, name: err instanceof Error ? err.name : "Error" });
    return c.json({ error: { code: "INTERNAL", message: "Unexpected error.", requestId, details: [] } }, 500);
  });

  app.get("/healthz", (c) => c.json({ ok: true }));

  app.get("/v1/ingress/bindings:resolve", async (c) => {
    const identity = authenticate(c.req.header("authorization"), deps.env);
    const provider = c.req.query("provider") ?? "";
    authorizeProvider(identity, provider, deps.env);
    const resolved = await resolveProviderBinding(deps.db, provider, c.req.query("externalAccountId") ?? "");
    deps.logger.write({
      severity: "INFO",
      message: "binding resolved",
      requestId: c.get("requestId"),
      tenantId: resolved.tenantId,
      bindingId: resolved.bindingId,
      provider,
    });
    return c.json(resolved);
  });

  app.post("/v1/ingress/events", async (c) => {
    const identity = authenticate(c.req.header("authorization"), deps.env);
    const raw = await c.req.json<InboundEvent & { receipt?: unknown }>();
    const body: InboundEvent = {
      eventType: raw.eventType,
      occurredAt: raw.occurredAt,
      occurredAtSource: raw.occurredAtSource,
      correlationId: raw.correlationId,
      campaignId: raw.campaignId,
      leadId: raw.leadId,
      tenantId: raw.tenantId,
      source: raw.source,
      attributes: raw.attributes,
    };
    authorizeProvider(identity, body.source?.provider ?? "", deps.env);
    const result = await ingestEvent(deps.db, body);
    deps.logger.write({
      severity: "INFO",
      message: "event ingested",
      requestId: c.get("requestId"),
      tenantId: result.tenantId,
      eventId: result.eventId,
      eventType: body.eventType,
      provider: body.source?.provider,
      providerEventId: body.source?.providerEventId,
      replayed: result.replayed,
    });
    return c.json(
      { eventId: result.eventId, leadId: result.leadId, replayed: result.replayed, receiptId: result.receiptId },
      result.status,
    );
  });

  return app;
}

function errorStatus(status: number): 400 | 401 | 403 | 404 | 409 | 422 | 500 {
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 409 || status === 422) return status;
  return 500;
}
