import { ApiError } from "@raas/domain";
import { auth, firestore, resolvePrincipal, type Caller, type VerifiedIdentity } from "@raas/store";

export function bearer(authorization: string | undefined): string {
  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiError(401, "UNAUTHENTICATED", "A Firebase ID token is required.");
  }
  return authorization.slice("Bearer ".length);
}

export async function callerFromAuthorization(authorization: string | undefined): Promise<Caller> {
  const token = bearer(authorization);
  try {
    const decoded = await auth().verifyIdToken(token);
    const record = decoded as typeof decoded & { hd?: string };
    const identity: VerifiedIdentity = {
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : undefined,
      hostedDomain: typeof record.hd === "string" ? record.hd : undefined,
      signInProvider: decoded.firebase?.sign_in_provider,
      claimedRole: typeof decoded.raasRole === "string" ? decoded.raasRole : undefined,
      claimedTenantId: typeof decoded.tenantId === "string" ? decoded.tenantId : undefined,
    };
    return resolvePrincipal(firestore(), identity);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code.startsWith("auth/") && code !== "auth/internal-error" && code !== "auth/insufficient-permission") {
      throw new ApiError(401, "UNAUTHENTICATED", "A Firebase ID token is required.");
    }
    throw error;
  }
}
