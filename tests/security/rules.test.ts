import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadString } from "firebase/storage";

const TENANT_A = "ten_rulesA";
const TENANT_B = "ten_rulesB";

describe("client access rules", () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: "demo-raas-cp",
      firestore: {
        rules: readFileSync("firebase/firestore.rules", "utf8"),
        host: "127.0.0.1",
        port: 8280,
      },
      storage: {
        rules: readFileSync("firebase/storage.rules", "utf8"),
        host: "127.0.0.1",
        port: 9399,
      },
    });
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "platformAdmins/admin-1"), { status: "active", email: "admin@alamotechllc.com" });
      await setDoc(doc(db, "platformAdmins/gmail-admin"), { status: "active", email: "person@gmail.com" });
      await setDoc(doc(db, "platformAdmins/disabled-admin"), { status: "disabled", email: "disabled@alamotechllc.com" });
      await setDoc(doc(db, "operators/operator-1"), { status: "active", email: "operator@alamotechllc.com" });
      await setDoc(doc(db, `operators/operator-1/assignments/${TENANT_A}`), { tenantId: TENANT_A });
      await setDoc(doc(db, `tenants/${TENANT_A}`), { legalName: "Tenant A", status: "active" });
      await setDoc(doc(db, `tenants/${TENANT_B}`), { legalName: "Tenant B", status: "active" });
      await setDoc(doc(db, `tenants/${TENANT_A}/members/viewer-1`), { role: "tenant_viewer", status: "active" });
      await setDoc(doc(db, `tenants/${TENANT_A}/members/admin-tenant`), { role: "tenant_admin", status: "active" });
      await setDoc(doc(db, `tenants/${TENANT_A}/members/disabled-member`), { role: "tenant_viewer", status: "disabled" });
      await setDoc(doc(db, `tenants/${TENANT_A}/leads/led_1`), { status: "open" });
      await setDoc(doc(db, `tenants/${TENANT_A}/providerBindings/bnd_1`), { secretResource: "projects/demo/secrets/x" });
      await setDoc(doc(db, `tenants/${TENANT_A}/businessEvents/evt_1`), { eventType: "AppointmentBooked" });
      await setDoc(doc(db, `tenants/${TENANT_A}/auditEvents/aud_1`), { action: "tenant.create" });
    });
  });

  afterAll(async () => {
    await env.cleanup();
  });

  function client(uid: string, email: string, claims: Record<string, unknown> = {}) {
    const provider = email.endsWith("@alamotechllc.com") ? "google.com" : "custom";
    return env.authenticatedContext(uid, {
      email,
      firebase: { sign_in_provider: provider },
      ...claims,
    }).firestore();
  }

  it("denies anonymous clients and storage writes", async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, `tenants/${TENANT_A}`)));
    await assertFails(setDoc(doc(anon, `tenants/${TENANT_A}/leads/led_x`), { status: "open" }));
    const storage = env.unauthenticatedContext().storage();
    await assertFails(uploadString(ref(storage, "tenants/ten_x/providers/gohighlevel/payload.json"), "{}"));
  });

  it("denies a signed-in user with no grant, including a role claim", async () => {
    const signedIn = client("stranger", "stranger@alamotechllc.com", { raasRole: "platform_admin", tenantId: TENANT_A });
    await assertFails(getDoc(doc(signedIn, `tenants/${TENANT_A}`)));
    await assertFails(getDoc(doc(signedIn, `tenants/${TENANT_A}/leads/led_1`)));
    await assertFails(setDoc(doc(signedIn, "platformAdmins/stranger"), { status: "active", email: "stranger@alamotechllc.com" }));
  });

  it("denies an external Google account even when a staff document exists", async () => {
    const gmail = client("gmail-admin", "person@gmail.com");
    await assertFails(getDoc(doc(gmail, `tenants/${TENANT_A}`)));
  });

  it("lets an active platform admin read tenant data and blocks writes and server-only records", async () => {
    const admin = client("admin-1", "admin@alamotechllc.com", { raasRole: "platform_admin" });
    await assertSucceeds(getDoc(doc(admin, `tenants/${TENANT_A}`)));
    await assertSucceeds(getDoc(doc(admin, `tenants/${TENANT_B}/leads/missing`)));
    await assertFails(setDoc(doc(admin, `tenants/${TENANT_A}`), { legalName: "Changed" }));
    await assertFails(getDoc(doc(admin, `tenants/${TENANT_A}/providerBindings/bnd_1`)));
    await assertFails(getDoc(doc(admin, `tenants/${TENANT_A}/businessEvents/evt_1`)));
    await assertFails(getDoc(doc(admin, `tenants/${TENANT_A}/auditEvents/aud_1`)));
    await assertFails(getDoc(doc(admin, "platformAudit/aud_1")));
  });

  it("denies a disabled platform admin", async () => {
    const disabled = client("disabled-admin", "disabled@alamotechllc.com");
    await assertFails(getDoc(doc(disabled, `tenants/${TENANT_A}`)));
  });

  it("limits an operator to assigned tenants", async () => {
    const operator = client("operator-1", "operator@alamotechllc.com");
    await assertSucceeds(getDoc(doc(operator, `tenants/${TENANT_A}`)));
    await assertFails(getDoc(doc(operator, `tenants/${TENANT_B}`)));
    await assertFails(setDoc(doc(operator, `tenants/${TENANT_A}/leads/led_1`), { status: "closed" }));
  });

  it("limits a tenant viewer to their tenant and blocks writes", async () => {
    const viewer = client("viewer-1", "viewer@client.example", { tenantId: TENANT_A });
    await assertSucceeds(getDoc(doc(viewer, `tenants/${TENANT_A}/leads/led_1`)));
    await assertFails(getDoc(doc(viewer, `tenants/${TENANT_B}`)));
    await assertFails(setDoc(doc(viewer, `tenants/${TENANT_A}/appointments/apt_1`), { status: "booked" }));
    await assertFails(getDoc(doc(viewer, `tenants/${TENANT_A}/providerBindings/bnd_1`)));
  });

  it("does not let a disabled membership read the tenant", async () => {
    const member = client("disabled-member", "member@client.example", { tenantId: TENANT_A });
    await assertFails(getDoc(doc(member, `tenants/${TENANT_A}`)));
  });

  it("does not let one user read another user's authorization record", async () => {
    const viewer = client("viewer-1", "viewer@client.example");
    await assertFails(getDoc(doc(viewer, "platformAdmins/admin-1")));
    await assertFails(getDoc(doc(viewer, "operators/operator-1")));
  });
});
