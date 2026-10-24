import { describe, expect, it } from "vitest";
import { assertDevelopmentSeedAllowed } from "@raas/store";

describe("development seed guard", () => {
  it("refuses to seed when the Firestore emulator is not configured", () => {
    expect(() => assertDevelopmentSeedAllowed({})).toThrow(/Production is not seeded/);
  });

  it("refuses a non-demo project id even if an emulator host is set", () => {
    expect(() =>
      assertDevelopmentSeedAllowed({
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8280",
        FIREBASE_PROJECT_ID: "raas-cp-prod",
      }),
    ).toThrow(/demo emulator project/);
  });

  it("allows the local demo project", () => {
    expect(() =>
      assertDevelopmentSeedAllowed({
        FIRESTORE_EMULATOR_HOST: "127.0.0.1:8280",
        FIREBASE_PROJECT_ID: "demo-raas-cp",
      }),
    ).not.toThrow();
  });
});
