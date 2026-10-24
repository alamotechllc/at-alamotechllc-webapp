import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import { ApiError, hasPermission, newId, type Permission, type RaasRole } from "@raas/domain";
import { staffEligible, type StaffIdentity } from "@raas/auth";

export interface Caller {
  uid: string;
  raasRole?: RaasRole;
  tenantId?: string;
  email?: string;
  hostedDomain?: string;
  signInProvider?: string;
}

export interface VerifiedIdentity {
  uid: string;
  email?: string;
  hostedDomain?: string;
  signInProvider?: string;
  claimedRole?: string;
  claimedTenantId?: string;
}

function staffIdentity(caller: { email?: string; hostedDomain?: string; signInProvider?: string }): StaffIdentity {
  return {
    email: caller.email,
    hostedDomain: caller.hostedDomain,
    signInProvider: caller.signInProvider,
    emulator: Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST),
    operatorDomain: process.env.OPERATOR_HOSTED_DOMAIN,
  };
}

function deny(code: "ACCESS_NOT_AUTHORIZED" | "ACCOUNT_DISABLED" | "PERMISSION_DENIED" | "TENANT_FORBIDDEN"): never {
  throw new ApiError(403, code, "Access is not authorized.");
}

export async function resolvePrincipal(db: Firestore, identity: VerifiedIdentity): Promise<Caller> {
  const base = {
    uid: identity.uid,
    email: identity.email,
    hostedDomain: identity.hostedDomain,
    signInProvider: identity.signInProvider,
  };
  const admin = await db.doc(`platformAdmins/${identity.uid}`).get();
  if (admin.exists) {
    if (admin.data()?.status === "disabled") deny("ACCOUNT_DISABLED");
    if (admin.data()?.status === "active") {
      if (!staffEligible(staffIdentity(base))) deny("PERMISSION_DENIED");
      return { ...base, raasRole: "platform_admin" };
    }
  }

  const operator = await db.doc(`operators/${identity.uid}`).get();
  if (operator.exists) {
    if (operator.data()?.status === "disabled") deny("ACCOUNT_DISABLED");
    if (operator.data()?.status === "active") {
      if (!staffEligible(staffIdentity(base))) deny("PERMISSION_DENIED");
      return { ...base, raasRole: "operator" };
    }
  }

  const tenantId = identity.claimedTenantId;
  if (tenantId && /^ten_[A-Za-z0-9]+$/.test(tenantId)) {
    const member = await db.doc(`tenants/${tenantId}/members/${identity.uid}`).get();
    if (member.exists) {
      if (member.data()?.status !== "active") deny("ACCOUNT_DISABLED");
      const role = member.data()?.role;
      if (role !== "tenant_admin" && role !== "tenant_viewer") deny("ACCESS_NOT_AUTHORIZED");
      return { ...base, raasRole: role, tenantId };
    }
  }

  deny("ACCESS_NOT_AUTHORIZED");
}

export async function authorizePermission(
  db: Firestore,
  caller: Caller,
  tenantId: string,
  permission: Permission,
): Promise<void> {
  if (!hasPermission(caller.raasRole, permission)) deny("PERMISSION_DENIED");

  if (caller.raasRole === "platform_admin") {
    const admin = await db.doc(`platformAdmins/${caller.uid}`).get();
    if (admin.data()?.status !== "active" || !staffEligible(staffIdentity(caller))) deny("PERMISSION_DENIED");
    return;
  }

  if (caller.raasRole === "operator") {
    if (!staffEligible(staffIdentity(caller))) deny("PERMISSION_DENIED");
    const operator = await db.doc(`operators/${caller.uid}`).get();
    const assignment = await db.doc(`operators/${caller.uid}/assignments/${tenantId}`).get();
    if (operator.data()?.status === "disabled") deny("ACCOUNT_DISABLED");
    if (operator.data()?.status !== "active" || !assignment.exists) deny("TENANT_FORBIDDEN");
    return;
  }

  if (caller.tenantId !== tenantId) deny("TENANT_FORBIDDEN");
  const member = await db.doc(`tenants/${tenantId}/members/${caller.uid}`).get();
  if (member.data()?.status === "disabled") deny("ACCOUNT_DISABLED");
  if (member.data()?.status !== "active" || member.data()?.role !== caller.raasRole) deny("TENANT_FORBIDDEN");
}

/** Writes and other operator routes. Reads use authorizePermission with a read permission. */
export async function authorizeOperatorAccess(db: Firestore, caller: Caller, tenantId: string): Promise<void> {
  await authorizePermission(db, caller, tenantId, "providerBinding.manage");
}

export async function authorizeTenantRead(db: Firestore, caller: Caller, tenantId: string): Promise<void> {
  await authorizePermission(db, caller, tenantId, "tenant.read");
}

export interface AuditChange {
  action:
    | "user.role_changed"
    | "user.disabled"
    | "user.enabled"
    | "tenant.member_added"
    | "tenant.member_removed"
    | "operator.assignment_added"
    | "operator.assignment_removed";
  actorUid: string;
  targetUid: string;
  tenantId?: string;
  requestId: string;
  role?: RaasRole;
}

export async function writeAuthorizationAudit(db: Firestore, change: AuditChange): Promise<string> {
  const auditId = newId("aud");
  const record = {
    auditId,
    action: change.action,
    actorUid: change.actorUid,
    targetUid: change.targetUid,
    ...(change.tenantId ? { tenantId: change.tenantId } : {}),
    ...(change.role ? { role: change.role } : {}),
    requestId: change.requestId,
    occurredAt: FieldValue.serverTimestamp(),
  };
  await db.collection("platformAudit").doc(auditId).set(record);
  if (change.tenantId) {
    await db.collection(`tenants/${change.tenantId}/auditEvents`).doc(auditId).set(record);
  }
  return auditId;
}

export async function grantPlatformAdmin(
  db: Firestore,
  adminAuth: Auth,
  input: { uid: string; email: string; actorUid: string; requestId: string; hostedDomain?: string; signInProvider?: string },
): Promise<void> {
  const identity = staffIdentity({
    email: input.email,
    hostedDomain: input.hostedDomain,
    signInProvider: input.signInProvider ?? (process.env.FIREBASE_AUTH_EMULATOR_HOST ? "custom" : "google.com"),
  });
  if (!staffEligible(identity)) {
    throw new ApiError(403, "PERMISSION_DENIED", "Access is not authorized.");
  }
  await db.doc(`platformAdmins/${input.uid}`).set({
    uid: input.uid,
    email: input.email,
    status: "active",
    hostedDomain: input.hostedDomain ?? identity.operatorDomain ?? "alamotechllc.com",
    updatedAt: FieldValue.serverTimestamp(),
  });
  await adminAuth.setCustomUserClaims(input.uid, { raasRole: "platform_admin" });
  await adminAuth.revokeRefreshTokens(input.uid);
  await writeAuthorizationAudit(db, {
    action: "user.role_changed",
    actorUid: input.actorUid,
    targetUid: input.uid,
    requestId: input.requestId,
    role: "platform_admin",
  });
}
