import { describe, expect, it } from "vitest";
import { authenticateLocalAdapter, authorizeAdapterProvider } from "@raas/auth";
import { requireTenantId } from "@raas/store";
import { JsonLogger } from "@raas/logging";

const local = {
  OIDC_MODE: "local",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8280",
  LOCAL_INGRESS_TOKEN: "local-test",
  LOCAL_ADAPTER_EMAIL: "raas-adapter@local.test",
  LOCAL_ADAPTER_PROVIDERS: "gohighlevel",
};

describe("ingress authentication", () => {
  it("rejects a missing emulator and a bad token", () => {
    expect(() => authenticateLocalAdapter("Bearer local-test", { OIDC_MODE: "local" })).toThrow(/not configured/);
    expect(() => authenticateLocalAdapter("Bearer wrong", local)).toThrow(/invalid/);
    expect(authenticateLocalAdapter("Bearer local-test", local).email).toBe("raas-adapter@local.test");
  });

  it("rejects a provider the adapter is not allowed to send", () => {
    const identity = authenticateLocalAdapter("Bearer local-test", local);
    expect(() => authorizeAdapterProvider(identity, "other-vendor", local)).toThrow(/not allowed/);
    expect(() => authorizeAdapterProvider(identity, "gohighlevel", local)).not.toThrow();
  });
});

describe("tenant boundary", () => {
  it("requires a tenant id before an operational path is built", () => {
    expect(() => requireTenantId("")).toThrow(/tenantId/);
    expect(() => requireTenantId("ten_a/leads")).toThrow(/tenantId/);
    expect(requireTenantId("ten_a")).toBe("ten_a");
  });
});

describe("PII logging", () => {
  it("redacts names, message bodies, recordings, and signed URLs", () => {
    const lines: string[] = [];
    new JsonLogger((line) => lines.push(line)).write({
      severity: "INFO",
      message: "event ingested",
      requestId: "req_fixture",
      eventId: "evt_fixture",
      givenName: "Ada",
      messageBody: "call me back",
      recordingUrl: "https://example.test/recording",
      signedUrl: "https://example.test/signed",
      inlineBase64: "abc",
      cookie: "session",
    });
    const line = lines[0] ?? "";
    expect(line).toContain("req_fixture");
    expect(line).toContain("evt_fixture");
    expect(line).toContain("event ingested");
    expect(line).not.toContain("Ada");
    expect(line).not.toContain("call me back");
    expect(line).not.toContain("example.test");
    expect(line).not.toContain("session");
  });
});
