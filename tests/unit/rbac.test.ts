import { describe, expect, it } from "vitest";
import { hasPermission } from "../../packages/domain/src/rbac.js";
import { staffEligible } from "../../packages/auth/src/staffDomain.js";

describe("RBAC", () => {
  it("gives tenant viewers reads and not binding management", () => {
    expect(hasPermission("tenant_viewer", "result.read")).toBe(true);
    expect(hasPermission("tenant_viewer", "providerBinding.manage")).toBe(false);
    expect(hasPermission("tenant_admin", "providerBinding.manage")).toBe(false);
    expect(hasPermission("operator", "providerBinding.manage")).toBe(true);
    expect(hasPermission("platform_admin", "tenant.read")).toBe(true);
    expect(hasPermission(undefined, "tenant.read")).toBe(false);
  });

  it("treats the Workspace domain as eligibility, not a role", () => {
    expect(staffEligible({ email: "person@alamotechllc.com", signInProvider: "google.com", emulator: false })).toBe(true);
    expect(staffEligible({ email: "person@gmail.com", signInProvider: "google.com", emulator: false })).toBe(false);
    expect(staffEligible({ email: "person@alamotechllc.com", hostedDomain: "gmail.com", signInProvider: "google.com", emulator: false })).toBe(false);
    expect(staffEligible({ email: "person@alamotechllc.com", signInProvider: "password", emulator: false })).toBe(false);
    expect(staffEligible({ email: "operator@alamotechllc.test", signInProvider: "password", emulator: true })).toBe(true);
    expect(staffEligible({ email: "person@gmail.com", signInProvider: "google.com", emulator: true })).toBe(false);
  });
});
