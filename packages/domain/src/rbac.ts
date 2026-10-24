/** UX and API share these names. The API re-reads Firestore; this map is not a grant. */

export const RAAS_ROLES = ["platform_admin", "operator", "tenant_admin", "tenant_viewer"] as const;
export type RaasRole = (typeof RAAS_ROLES)[number];

export const PERMISSIONS = [
  "tenant.read",
  "appointment.read",
  "result.read",
  "providerBinding.read",
  "providerBinding.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const GRANTS: Record<RaasRole, readonly Permission[]> = {
  platform_admin: PERMISSIONS,
  operator: PERMISSIONS,
  tenant_admin: ["tenant.read", "appointment.read", "result.read", "providerBinding.read"],
  tenant_viewer: ["tenant.read", "appointment.read", "result.read", "providerBinding.read"],
};

export function isRaasRole(value: string | undefined): value is RaasRole {
  return RAAS_ROLES.includes(value as RaasRole);
}

export function hasPermission(role: string | undefined, permission: Permission): boolean {
  if (!isRaasRole(role)) return false;
  return GRANTS[role].includes(permission);
}

export const STAFF_ROLES = ["platform_admin", "operator"] as const;

export function isStaffRole(role: string | undefined): boolean {
  return role === "platform_admin" || role === "operator";
}
