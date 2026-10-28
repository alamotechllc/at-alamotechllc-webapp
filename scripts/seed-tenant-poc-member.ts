import { TENANT_ZERO, TENANT_ZERO_POC_MEMBER_UID } from "@raas/domain";
import { auth, firestore, tenantDoc } from "@raas/store";

const email = process.env.LOCAL_TENANT_EMAIL ?? "tenant.admin@client.example";
const password = process.env.LOCAL_TENANT_PASSWORD ?? "local-dev-only";
const uid = TENANT_ZERO_POC_MEMBER_UID;

try {
  await auth().createUser({ uid, email, password, emailVerified: true });
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code !== "auth/uid-already-exists" && code !== "auth/email-already-exists") throw error;
  await auth().updateUser(uid, { email, password, emailVerified: true });
}

await auth().setCustomUserClaims(uid, { raasRole: "tenant_admin", tenantId: TENANT_ZERO.tenantId });

const db = firestore();
await tenantDoc(db, TENANT_ZERO.tenantId, "members", uid).set(
  { role: "tenant_admin", status: "active" },
  { merge: true },
);

console.log(JSON.stringify({ tenantAdmin: email, uid, tenantId: TENANT_ZERO.tenantId }));
