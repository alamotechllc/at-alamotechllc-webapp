export const DEFAULT_OPERATOR_DOMAIN = "alamotechllc.com";
export const EMULATOR_STAFF_DOMAIN = "alamotechllc.test";

export interface StaffIdentity {
  email?: string;
  hostedDomain?: string;
  signInProvider?: string;
  emulator: boolean;
  operatorDomain?: string;
}

/** Eligible to hold platform_admin or operator. Eligibility is not a role grant. */
export function staffEligible(identity: StaffIdentity): boolean {
  const domain = (identity.operatorDomain || DEFAULT_OPERATOR_DOMAIN).toLowerCase();
  const emailDomain = identity.email?.split("@")[1]?.toLowerCase();
  const hosted = identity.hostedDomain?.toLowerCase();
  if (hosted && hosted !== domain) return false;
  if (identity.emulator && emailDomain === EMULATOR_STAFF_DOMAIN) return true;
  const domainMatches = hosted === domain || emailDomain === domain;
  if (!domainMatches) return false;
  if (identity.emulator) return true;
  return identity.signInProvider === "google.com";
}
