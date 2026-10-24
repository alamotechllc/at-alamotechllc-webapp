import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadString } from "firebase/storage";

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
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("denies anonymous and signed-in Firestore clients", async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, "tenants/ten_x/businessEvents/evt_x")));
    await assertFails(setDoc(doc(anon, "tenants/ten_x/businessEvents/evt_x"), { eventType: "AppointmentBooked" }));

    const signedIn = env.authenticatedContext("user-1", { raasRole: "platform_admin", tenantId: "ten_x" }).firestore();
    await assertFails(getDoc(doc(signedIn, "tenants/ten_x/businessEvents/evt_x")));
    await assertFails(getDoc(doc(signedIn, "tenants/ten_x/providerBindings/bnd_x")));
    await assertFails(getDoc(doc(signedIn, "tenants/ten_x/auditEvents/aud_x")));
    await assertFails(setDoc(doc(signedIn, "tenants/ten_x/leads/led_x"), { status: "open" }));
  });

  it("denies client storage writes", async () => {
    const storage = env.unauthenticatedContext().storage();
    await assertFails(uploadString(ref(storage, "tenants/ten_x/providers/gohighlevel/payload.json"), "{}"));
    expect(true).toBe(true);
  });
});
