export {
  authorizeOperatorAccess,
  authorizePermission,
  authorizeTenantRead,
  grantPlatformAdmin,
  resolvePrincipal,
  writeAuthorizationAudit,
} from "./access.js";
export type { AuditChange, Caller, VerifiedIdentity } from "./access.js";
