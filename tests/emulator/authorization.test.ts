import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@raas/domain";
import { MemoryLogger } from "@raas/logging";
import { MemorySecretStore } from "@raas/secrets";
import { auth, firestore, grantPlatformAdmin, writeAuthorizationAudit } from "@raas/store";
import { createApiApp } from "../../services/raas-api/src/app.js";
import { callerFromAuthorization } from "../../services/raas-api/src/identity.js";

const TENANT_A = "ten_authzA";
const TENANT_B = "ten_authzB";

async function idToken(uid: string, email: string, claims: Record<string, unknown> = {}): Promise<string> {
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

describe("Google identity is not authorization", () => {
  const db = firestore();
  const api = createApiApp({
    db,
    logger: new MemoryLogger(),
    secrets: new MemorySecretStore("demo-raas-cp"),
    verifyUser: callerFromAuthorization,
    projectId: "demo-raas-cp",
  });

  beforeAll(async () => {
    await db.doc(`tenants/${TENANT_A}`).set({ tenantId: TENANT_A, legalName: "Tenant A", status: "active", timezone: "America/Chicago" });
    await db.doc(`tenants/${TENANT_B}`).set({ tenantId: TENANT_B, legalName: "Tenant B", status: "active", timezone: "America/Chicago" });
  });

  async function status(path: string, token?: string, method = "GET", body?: string): Promise<number> {
    const response = await api.request(path, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body ? { "content-type": "application/json", "idempotency-key": `authz-${Date.now()}` } : {}),
      },
      body,
    });
    return response.status;
  }

  async function code(path: string, token?: string, method = "GET", body?: string): Promise<string> {
    const response = await api.request(path, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body ? { "content-type": "application/json", "idempotency-key": `authz-code-${Date.now()}` } : {}),
      },
      body,
    });
    const json = (await response.json()) as { error?: { code?: string }; legalName?: string };
    return json.error?.code ?? (response.status === 200 ? "OK" : String(response.status));
  }

  it("denies an unauthenticated caller", async () => {
    expect(await status(`/v1/tenants/${TENANT_A}`)).toBe(401);
  });

  it("denies an authenticated user with no authorization record", async () => {
    const token = await idToken("authz-nobody", "random@gmail.com");
    expect(await code("/v1/session", token)).toBe("ACCESS_NOT_AUTHORIZED");
  });

  it("denies an Alamo Tech domain user with no role", async () => {
    const token = await idToken("authz-domain", "staff@alamotechllc.com");
    expect(await code("/v1/session", token)).toBe("ACCESS_NOT_AUTHORIZED");
  });

  it("allows a platform admin recorded on the server", async () => {
    await auth().createUser({ uid: "authz-admin", email: "admin-authz@alamotechllc.test", emailVerified: true }).catch(() => undefined);
    await grantPlatformAdmin(db, auth(), {
      uid: "authz-admin",
      email: "admin-authz@alamotechllc.test",
      actorUid: "test",
      requestId: "authz-admin",
      signInProvider: "custom",
    });
    const token = await idToken("authz-admin", "admin-authz@alamotechllc.test", { raasRole: "platform_admin" });
    expect(await status(`/v1/tenants/${TENANT_A}`, token)).toBe(200);
    expect(await status(`/v1/tenants/${TENANT_B}`, token)).toBe(200);
  });

  it("allows an operator only on an assigned tenant", async () => {
    await db.doc("operators/authz-operator").set({ status: "active", platformRole: "operator" });
    await db.doc(`operators/authz-operator/assignments/${TENANT_A}`).set({ tenantId: TENANT_A });
    const token = await idToken("authz-operator", "operator-authz@alamotechllc.test", { raasRole: "operator" });
    expect(await status(`/v1/tenants/${TENANT_A}`, token)).toBe(200);
    expect(await code(`/v1/tenants/${TENANT_B}`, token)).toBe("TENANT_FORBIDDEN");
  });

  it("keeps a tenant admin inside their membership", async () => {
    await db.doc(`tenants/${TENANT_A}/members/authz-tadmin`).set({ role: "tenant_admin", status: "active" });
    const token = await idToken("authz-tadmin", "owner@gmail.com", { raasRole: "tenant_admin", tenantId: TENANT_A });
    expect(await status(`/v1/tenants/${TENANT_A}`, token)).toBe(200);
    expect(await code(`/v1/tenants/${TENANT_B}`, token)).toBe("TENANT_FORBIDDEN");
  });

  it("lets a tenant viewer read and refuses a privileged write", async () => {
    await db.doc(`tenants/${TENANT_A}/members/authz-viewer`).set({ role: "tenant_viewer", status: "active" });
    const token = await idToken("authz-viewer", "viewer@gmail.com", { raasRole: "tenant_viewer", tenantId: TENANT_A });
    await db.doc(`tenants/${TENANT_A}/serviceInstances/ins_authz`).set({
      instanceId: "ins_authz",
      productCode: "lead-capture",
      status: "active",
      metricPolicyVersion: "1",
    });
    expect(await status(`/v1/tenants/${TENANT_A}/results?serviceInstanceId=ins_authz&from=2026-10-01T00:00:00.000Z&to=2026-11-01T00:00:00.000Z`, token)).toBe(200);
    const denied = await code(
      `/v1/tenants/${TENANT_A}/provider-bindings`,
      token,
      "POST",
      JSON.stringify({ serviceInstanceId: "ins_x", channel: "calendar", provider: "gohighlevel", externalAccountId: "loc_authz", secretValue: "secret" }),
    );
    expect(denied).toBe("PERMISSION_DENIED");
  });

  it("denies a disabled operator and a revoked membership", async () => {
    await db.doc("operators/authz-disabled").set({ status: "disabled", platformRole: "operator" });
    const disabled = await idToken("authz-disabled", "disabled@alamotechllc.test", { raasRole: "operator" });
    expect(await code("/v1/session", disabled)).toBe("ACCOUNT_DISABLED");

    await db.doc(`tenants/${TENANT_A}/members/authz-revoked`).set({ role: "tenant_viewer", status: "disabled" });
    const revoked = await idToken("authz-revoked", "revoked@gmail.com", { raasRole: "tenant_viewer", tenantId: TENANT_A });
    expect(await code(`/v1/tenants/${TENANT_A}`, revoked)).toBe("ACCOUNT_DISABLED");
  });

  it("denies an operator after the assignment is removed", async () => {
    await db.doc("operators/authz-removed").set({ status: "active", platformRole: "operator" });
    await db.doc(`operators/authz-removed/assignments/${TENANT_A}`).set({ tenantId: TENANT_A });
    const token = await idToken("authz-removed", "removed@alamotechllc.test", { raasRole: "operator" });
    expect(await status(`/v1/tenants/${TENANT_A}`, token)).toBe(200);
    await db.doc(`operators/authz-removed/assignments/${TENANT_A}`).delete();
    expect(await code(`/v1/tenants/${TENANT_A}`, token)).toBe("TENANT_FORBIDDEN");
  });

  it("ignores a forged platform_admin or operator claim from an external account", async () => {
    await db.doc("platformAdmins/authz-forge-admin").set({ status: "active", email: "forge@gmail.com" });
    await db.doc("operators/authz-forge-operator").set({ status: "active", platformRole: "operator" });
    const admin = await idToken("authz-forge-admin", "forge@gmail.com", { raasRole: "platform_admin" });
    const operator = await idToken("authz-forge-operator", "other@gmail.com", { raasRole: "operator" });
    expect(await code("/v1/session", admin)).toBe("PERMISSION_DENIED");
    expect(await code("/v1/session", operator)).toBe("PERMISSION_DENIED");
  });

  it("denies a domain user who has no tenant assignment", async () => {
    await db.doc("operators/authz-unassigned").set({ status: "active", platformRole: "operator" });
    const token = await idToken("authz-unassigned", "unassigned@alamotechllc.com", { raasRole: "operator" });
    expect(await code(`/v1/tenants/${TENANT_A}`, token)).toBe("TENANT_FORBIDDEN");
  });

  it("denies a tenant id that does not match the membership", async () => {
    await db.doc(`tenants/${TENANT_A}/members/authz-mismatch`).set({ role: "tenant_viewer", status: "active" });
    const token = await idToken("authz-mismatch", "mismatch@gmail.com", { raasRole: "tenant_viewer", tenantId: TENANT_B });
    expect(await code(`/v1/tenants/${TENANT_A}`, token)).toBe("ACCESS_NOT_AUTHORIZED");
  });

  it("records an authorization change", async () => {
    const auditId = await writeAuthorizationAudit(db, {
      action: "operator.assignment_added",
      actorUid: "authz-admin",
      targetUid: "authz-operator",
      tenantId: TENANT_A,
      requestId: "authz-audit",
      role: "operator",
    });
    const saved = await db.doc(`platformAudit/${auditId}`).get();
    expect(saved.data()?.action).toBe("operator.assignment_added");
    expect(saved.data()?.targetUid).toBe("authz-operator");
    expect(JSON.stringify(saved.data())).not.toContain("token");
  });

  it("keeps operational Firestore closed to authenticated clients", () => {
    const rules = readFileSync("firebase/firestore.rules", "utf8");
    expect(rules).toContain("allow read, write: if false");
    expect(rules).not.toContain("allow read, write: if request.auth != null");
    expect(rules).toContain("canReadTenant");
  });

  it("does not throw when the authorization error is an ApiError", () => {
    const error = new ApiError(403, "ACCESS_NOT_AUTHORIZED", "Access is not authorized.");
    expect(error.status).toBe(403);
  });
});
