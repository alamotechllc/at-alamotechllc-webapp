import { TENANT_ZERO } from "../../../packages/domain/src/tenantZero.js";
import type { RaasRole } from "../../../packages/domain/src/rbac.js";

export function workspaceTenantId(role: RaasRole | null, membershipTenantId: string | null): string {
  if (role === "tenant_admin" || role === "tenant_viewer") return membershipTenantId ?? "";
  return TENANT_ZERO.tenantId;
}
