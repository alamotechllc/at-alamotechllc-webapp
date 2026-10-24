import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { Logger } from "@raas/logging";
import type { SecretReader } from "@raas/secrets";
import type { IngressClient, IngressSubmitResult } from "./ingressClient.js";
import { mapGhlWebhook } from "./mapAppointment.js";
import { verifyProviderSignature } from "./signature.js";

const RECEIPT_LIMIT = 256 * 1024;

type Vars = { requestId: string };

export interface GhlAdapterDeps {
  ingress: IngressClient;
  secrets: SecretReader;
  logger: Logger;
  now?: () => Date;
  retryDelayMs?: (attempt: number) => number;
}

export function createGhlAdapterApp(deps: GhlAdapterDeps): Hono<{ Variables: Vars }> {
  const app = new Hono<{ Variables: Vars }>();
  app.use("*", async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? `req_${randomUUID()}`;
    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);
    await next();
  });
  app.onError((err, c) => {
    deps.logger.write({
      severity: "ERROR",
      message: "ghl adapter failed",
      requestId: c.get("requestId") ?? "req_unknown",
      name: err instanceof Error ? err.name : "Error",
    });
    return c.json({ error: { code: "INTERNAL", message: "Unexpected error.", requestId: c.get("requestId") } }, 500);
  });

  app.get("/healthz", (c) => c.json({ ok: true }));

  app.post("/webhooks/gohighlevel/:externalAccountId", async (c) => {
    const requestId = c.get("requestId");
    const externalAccountId = c.req.param("externalAccountId");
    const rawBody = await c.req.text();
    const binding = await deps.ingress.resolveBinding("gohighlevel", externalAccountId);
    if (!binding) {
      deps.logger.write({ severity: "WARNING", message: "ghl binding unknown", requestId, provider: "gohighlevel" });
      return c.json({ error: { code: "UNAUTHENTICATED", message: "Provider authentication failed.", requestId } }, 401);
    }
    let secret = "";
    try {
      secret = await deps.secrets.access(binding.secretResource);
      const signature = c.req.header("x-provider-signature");
      if (!verifyProviderSignature(secret, rawBody, signature)) {
        deps.logger.write({
          severity: "WARNING",
          message: "ghl signature rejected",
          requestId,
          provider: "gohighlevel",
          bindingId: binding.bindingId,
        });
        return c.json({ error: { code: "UNAUTHENTICATED", message: "Provider authentication failed.", requestId } }, 401);
      }
    } finally {
      secret = "";
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      deps.logger.write({
        severity: "WARNING",
        message: "ghl payload malformed",
        requestId,
        provider: "gohighlevel",
        bindingId: binding.bindingId,
      });
      return c.json({ error: { code: "VALIDATION_FAILED", message: "Webhook payload is malformed.", requestId } }, 400);
    }

    const mapped = mapGhlWebhook(payload, externalAccountId, deps.now?.() ?? new Date());
    if (mapped.kind === "ignore") {
      deps.logger.write({
        severity: "INFO",
        message: "ghl webhook ignored",
        requestId,
        provider: "gohighlevel",
        bindingId: binding.bindingId,
      });
      return c.json({ ignored: true }, 200);
    }
    if (mapped.kind === "invalid") {
      const status = mapped.issue === "missing" ? 422 : mapped.issue === "account_mismatch" ? 401 : 400;
      deps.logger.write({
        severity: "WARNING",
        message: "ghl appointment rejected",
        requestId,
        provider: "gohighlevel",
        bindingId: binding.bindingId,
        issue: mapped.issue,
      });
      return c.json({ error: { code: status === 401 ? "UNAUTHENTICATED" : "VALIDATION_FAILED", message: "Appointment could not be mapped.", requestId } }, status);
    }

    const receipt = receiptFor(rawBody);
    const result = await submitWithRetry(
      () => deps.ingress.submitEvent({ ...mapped.event, receipt }),
      deps.retryDelayMs ?? defaultDelay,
    );
    deps.logger.write({
      severity: result.status >= 500 ? "ERROR" : "INFO",
      message: "ghl appointment submitted",
      requestId,
      provider: "gohighlevel",
      providerEventId: mapped.event.source.providerEventId,
      bindingId: binding.bindingId,
      httpStatus: result.status,
      replayed: result.replayed,
    });
    if (result.status === 201 || result.status === 200) {
      return c.json({ replayed: result.replayed }, 200);
    }
    if (result.status === 409 || result.status === 422) {
      return c.json({ replayed: false, code: result.code ?? "IDEMPOTENCY_CONFLICT", ingressStatus: result.status }, 200);
    }
    if (result.status >= 500) {
      return c.json({ error: { code: "UPSTREAM", message: "Ingress unavailable.", requestId } }, 500);
    }
    return c.json({ error: { code: result.code ?? "INGRESS_REJECTED", message: "Ingress rejected the event.", requestId } }, 500);
  });

  return app;
}

function receiptFor(rawBody: string): { contentType: "application/json"; inlineBase64: string } {
  if (Buffer.byteLength(rawBody) > RECEIPT_LIMIT) {
    throw new Error("webhook body exceeds the inline receipt limit");
  }
  return { contentType: "application/json", inlineBase64: Buffer.from(rawBody, "utf8").toString("base64") };
}

async function submitWithRetry(
  submit: () => Promise<IngressSubmitResult>,
  delayMs: (attempt: number) => number,
): Promise<IngressSubmitResult> {
  let last: IngressSubmitResult = { status: 500, replayed: false };
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    last = await submit();
    if (last.status !== 500 && last.status !== 503) return last;
    if (attempt < 5) await wait(delayMs(attempt));
  }
  return last;
}

function defaultDelay(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** (attempt - 1));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
