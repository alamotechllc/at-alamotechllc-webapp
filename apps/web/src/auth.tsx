import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, type Firestore } from "firebase/firestore";
import { isRaasRole, type RaasRole } from "../../../packages/domain/src/rbac";

export const authUsesEmulator =
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true" ||
  (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS !== "false");

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || (authUsesEmulator ? "demo-raas-cp" : "");
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || (authUsesEmulator ? "demo-key" : "");
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (authUsesEmulator ? "localhost" : "");
export const authConfigError = projectId && apiKey && authDomain ? "" : "Firebase web configuration is missing.";
const app = authConfigError ? null : initializeApp({ apiKey, authDomain, projectId });
const auth = app ? getAuth(app) : null;
if (auth && authUsesEmulator && !auth.emulatorConfig) {
  const emulatorHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9198";
  connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
}
export const clientDb: Firestore | null = app ? getFirestore(app) : null;
const emulatorFlag = globalThis as { __raasFirestoreEmulator?: boolean };
if (clientDb && authUsesEmulator && !emulatorFlag.__raasFirestoreEmulator) {
  const host = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || "127.0.0.1:8280";
  const [hostname, port] = host.split(":");
  connectFirestoreEmulator(clientDb, hostname ?? "127.0.0.1", Number(port || "8280"));
  emulatorFlag.__raasFirestoreEmulator = true;
}

export type Access = "loading" | "anonymous" | "authorized" | "denied" | "disabled" | "expired" | "unavailable";

interface SessionProfile {
  role: RaasRole;
  tenantId?: string;
}

interface Session {
  user: User | null;
  role: RaasRole | null;
  tenantId: string | null;
  access: Access;
  ready: boolean;
  authError: string;
  signInWithGoogle: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  token: () => Promise<string>;
  retryAccess: () => void;
}

const SessionContext = createContext<Session | null>(null);

class AccessError extends Error {
  constructor(readonly kind: "denied" | "disabled" | "unavailable") {
    super(kind);
  }
}

function staffDomain(email: string | null): boolean {
  const domain = email?.split("@")[1]?.toLowerCase() ?? "";
  if (domain === "alamotechllc.com") return true;
  return authUsesEmulator && domain === "alamotechllc.test";
}

function field(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value : "";
}

async function loadProfile(user: User): Promise<SessionProfile> {
  if (!clientDb) throw new AccessError("unavailable");
  const email = user.email ?? "";
  const admin = await getDoc(doc(clientDb, "platformAdmins", user.uid));
  if (admin.exists()) {
    const data = admin.data();
    const status = field(data, "status");
    if (status === "disabled") throw new AccessError("disabled");
    if (status === "active" && staffDomain(email) && field(data, "email").toLowerCase() === email.toLowerCase()) {
      return { role: "platform_admin" };
    }
    throw new AccessError("denied");
  }

  const operator = await getDoc(doc(clientDb, "operators", user.uid));
  if (operator.exists()) {
    const data = operator.data();
    const status = field(data, "status");
    if (status === "disabled") throw new AccessError("disabled");
    if (status === "active" && staffDomain(email) && field(data, "email").toLowerCase() === email.toLowerCase()) {
      return { role: "operator" };
    }
    throw new AccessError("denied");
  }

  const token = await user.getIdTokenResult();
  const tenantId = typeof token.claims.tenantId === "string" ? token.claims.tenantId : "";
  if (/^ten_[A-Za-z0-9]+$/.test(tenantId)) {
    const member = await getDoc(doc(clientDb, "tenants", tenantId, "members", user.uid));
    if (member.exists()) {
      const data = member.data();
      if (field(data, "status") !== "active") throw new AccessError("disabled");
      const role = field(data, "role");
      if (role === "tenant_admin" || role === "tenant_viewer") return { role, tenantId };
    }
  }
  throw new AccessError("denied");
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<RaasRole | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [access, setAccess] = useState<Access>("loading");
  const [authError, setAuthError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!auth) {
      setAccess("anonymous");
      return;
    }
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setRole(null);
      setTenantId(null);
      setAccess(next ? "loading" : "anonymous");
      setAttempt((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadProfile(user)
      .then((profile) => {
        if (cancelled) return;
        if (!isRaasRole(profile.role)) {
          setAccess("denied");
          return;
        }
        setRole(profile.role);
        setTenantId(profile.tenantId ?? null);
        setAccess("authorized");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof AccessError && error.kind === "disabled") {
          setAccess("disabled");
          return;
        }
        if (error instanceof AccessError && error.kind === "denied") {
          setAccess("denied");
          return;
        }
        const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
        if (code.includes("permission-denied") || code.includes("unauthenticated")) {
          setAccess("denied");
          return;
        }
        setAccess("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [user, attempt]);

  const value = useMemo<Session>(() => ({
    user,
    role,
    tenantId,
    access,
    ready: access !== "loading",
    authError,
    async signInWithGoogle() {
      if (!auth) throw new Error(authConfigError);
      setAuthError("");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ hd: "alamotechllc.com", prompt: "select_account" });
      try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithPopup(auth, provider);
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
        if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
        setAuthError("Authentication failed.");
      }
    },
    async signIn(email, password) {
      if (!auth) throw new Error(authConfigError);
      setAuthError("");
      try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithEmailAndPassword(auth, email, password);
      } catch {
        setAuthError(authUsesEmulator ? "Sign-in failed. Check the emulator account and try again." : "Authentication failed.");
      }
    },
    async signOut() {
      if (!auth) return;
      await signOut(auth);
    },
    async token() {
      if (!auth?.currentUser) throw new Error("Sign-in is required.");
      return auth.currentUser.getIdToken();
    },
    retryAccess() {
      setAttempt((value) => value + 1);
    },
  }), [user, role, tenantId, access, authError]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider is missing.");
  return session;
}
