export { staffEligible, DEFAULT_OPERATOR_DOMAIN, EMULATOR_STAFF_DOMAIN } from "./staffDomain.js";
export type { StaffIdentity } from "./staffDomain.js";

import { ApiError } from "@raas/domain";

/**
 * Emulator stand-in for Google OIDC. Production mode fails closed.
 * A token is accepted only while the Firestore emulator is configured.
 */
export interface LocalIngressEnv {
  OIDC_MODE?: string;
  FIRESTORE_EMULATOR_HOST?: string;
  LOCAL_INGRESS_TOKEN?: string;
  LOCAL_ADAPTER_EMAIL?: string;
  LOCAL_ADAPTER_PROVIDERS?: string;
}

export interface AdapterIdentity {
  email: string;
}

export function authenticateLocalAdapter(authorization: string | undefined, env: LocalIngressEnv): AdapterIdentity {
  const emulator = Boolean(env.FIRESTORE_EMULATOR_HOST);
  const local = env.OIDC_MODE === "local";
  if (!emulator || !local) {
    throw new ApiError(401, "UNAUTHENTICATED", "Ingress identity is not configured for this process.");
  }
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  if (!env.LOCAL_INGRESS_TOKEN || token !== env.LOCAL_INGRESS_TOKEN) {
    throw new ApiError(401, "UNAUTHENTICATED", "Ingress credentials are missing or invalid.");
  }
  return { email: env.LOCAL_ADAPTER_EMAIL || "raas-adapter@local.test" };
}

export function authorizeAdapterProvider(identity: AdapterIdentity, provider: string, env: LocalIngressEnv): void {
  const allowed = (env.LOCAL_ADAPTER_PROVIDERS || "gohighlevel")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!identity.email || !provider || !allowed.includes(provider)) {
    throw new ApiError(403, "PERMISSION_DENIED", "Adapter is not allowed for this provider.");
  }
}

export function verifyLocalIngress(authorization: string | undefined, env: LocalIngressEnv): void {
  authenticateLocalAdapter(authorization, env);
}
