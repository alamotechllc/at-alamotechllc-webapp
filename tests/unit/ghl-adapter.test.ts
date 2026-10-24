import { mkdtemp, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { MemoryLogger } from "@raas/logging";
import { FileSecretStore, MemorySecretStore } from "@raas/secrets";
import { createGhlAdapterApp } from "../../services/ghl-adapter/src/app.js";
import type { IngressClient } from "../../services/ghl-adapter/src/ingressClient.js";
import { mapGhlWebhook } from "../../services/ghl-adapter/src/mapAppointment.js";
import { createAppointmentReconciler } from "../../services/ghl-adapter/src/reconcile.js";
import { signProviderBody, verifyProviderSignature } from "../../services/ghl-adapter/src/signature.js";

const mkdtempAsync = promisify(mkdtemp);
const fixtureDir = path.join(process.cwd(), "services/ghl-adapter/fixtures");
const booked = readFileSync(path.join(fixtureDir, "appointment-booked.json"), "utf8");
const signingSecret = "fixture-signing-secret-not-a-credential";

function ingress(overrides: Partial<IngressClient> = {}): IngressClient & { events: unknown[] } {
  const events: unknown[] = [];
  return {
    events,
    async resolveBinding() {
      return { bindingId: "bnd_fixture", secretResource: "projects/demo-raas-cp/secrets/raas-local-binding-bnd_fixture/versions/latest" };
    },
    async submitEvent(event) {
      events.push(event);
      return { status: 201, replayed: false };
    },
    ...overrides,
  };
}

describe("GoHighLevel appointment mapping", () => {
  it("maps a sanitized booking and leaves provider identity on source", () => {
    const mapped = mapGhlWebhook(JSON.parse(booked), "loc_tenant_zero_fixture", new Date("2026-10-23T18:05:00.000Z"));
    expect(mapped.kind).toBe("event");
    if (mapped.kind !== "event") return;
    expect(mapped.event.eventType).toBe("AppointmentBooked");
    expect(mapped.event.source).toEqual({
      provider: "gohighlevel",
      providerEventId: "appt_ghl_fixture_001",
      providerAccountId: "loc_tenant_zero_fixture",
      upstreamProvider: null,
      upstreamEventId: null,
    });
    expect(mapped.event.attributes).toEqual({
      providerAppointmentId: "appt_ghl_fixture_001",
      startAt: "2026-10-24T15:00:00.000Z",
      endAt: "2026-10-24T15:30:00.000Z",
      timezone: "America/Chicago",
      locationType: "video",
    });
    expect(mapped.event).not.toHaveProperty("tenantId");
    expect(JSON.stringify(mapped.event)).not.toContain("ghl-fixture-raw-marker");
  });

  it("rejects malformed and incomplete bookings and ignores other vendor types", () => {
    expect(mapGhlWebhook(JSON.parse(readFileSync(path.join(fixtureDir, "appointment-malformed.json"), "utf8")), "loc_tenant_zero_fixture", new Date()).kind).toBe("invalid");
    const missing = mapGhlWebhook(JSON.parse(readFileSync(path.join(fixtureDir, "appointment-missing-required.json"), "utf8")), "loc_tenant_zero_fixture", new Date());
    expect(missing).toMatchObject({ kind: "invalid", issue: "missing" });
    expect(mapGhlWebhook({ type: "ContactCreate", locationId: "loc_tenant_zero_fixture" }, "loc_tenant_zero_fixture", new Date()).kind).toBe("ignore");
  });

  it("verifies the local HMAC over the raw fixture bytes", () => {
    const signature = signProviderBody(signingSecret, booked);
    expect(verifyProviderSignature(signingSecret, booked, signature)).toBe(true);
    expect(verifyProviderSignature(signingSecret, booked, signProviderBody("other-secret", booked))).toBe(false);
  });
});

describe("secret manager abstraction", () => {
  it("stores a version the reader can access and does not echo the payload in the record list", async () => {
    const store = new MemorySecretStore("demo-raas-cp");
    const added = await store.addVersion("raas-local-binding-bnd_fixture", signingSecret);
    expect(added.secretResource).toBe("projects/demo-raas-cp/secrets/raas-local-binding-bnd_fixture/versions/latest");
    expect(await store.access(added.secretResource)).toBe(signingSecret);
    expect(store.addedSecretIds).toEqual(["raas-local-binding-bnd_fixture"]);
    expect(JSON.stringify(store.addedSecretIds)).not.toContain(signingSecret);
  });

  it("round-trips a file-backed version outside the repository", async () => {
    const directory = await mkdtempAsync(path.join(tmpdir(), "raas-secrets-"));
    const store = new FileSecretStore("demo-raas-cp", directory);
    const added = await store.addVersion("raas-local-binding-bnd_file", signingSecret);
    expect(await store.access(added.secretResource)).toBe(signingSecret);
  });
});

describe("appointment reconciliation seam", () => {
  it("returns null counts for webhook_only and does not call a provider", async () => {
    let listed = 0;
    const reconciler = createAppointmentReconciler({
      reconcileMode: "webhook_only",
      source: { async listAppointments() { listed += 1; return []; } },
    });
    await expect(reconciler.reconcile({
      externalAccountId: "loc_tenant_zero_fixture",
      from: "2026-10-01T00:00:00.000Z",
      to: "2026-11-01T00:00:00.000Z",
    })).resolves.toEqual({ reconcileMode: "webhook_only", seen: null, submitted: 0, replayed: 0 });
    expect(listed).toBe(0);
  });
});

describe("adapter webhook", () => {
  it("does not submit a booking with a bad signature", async () => {
    const secrets = new MemorySecretStore("demo-raas-cp");
    const added = await secrets.addVersion("raas-local-binding-bnd_fixture", signingSecret);
    const client = ingress({
      async resolveBinding() {
        return { bindingId: "bnd_fixture", secretResource: added.secretResource };
      },
    });
    const app = createGhlAdapterApp({ ingress: client, secrets, logger: new MemoryLogger(), retryDelayMs: () => 0 });
    const response = await app.request("/webhooks/gohighlevel/loc_tenant_zero_fixture", {
      method: "POST",
      headers: { "content-type": "application/json", "x-provider-signature": "00" },
      body: booked,
    });
    expect(response.status).toBe(401);
    expect(client.events).toHaveLength(0);
  });
});

describe("adapter source boundary", () => {
  it("does not import the control-plane store or a frontend variable", () => {
    const root = path.join(process.cwd(), "services/ghl-adapter/src");
    const source = readdirSync(root).map((name) => readFileSync(path.join(root, name), "utf8")).join("\n");
    expect(source).not.toContain("@raas/store");
    expect(source).not.toContain("firebase-admin");
    expect(source).not.toContain("VITE_");
    expect(source).not.toContain(signingSecret);
  });
});
