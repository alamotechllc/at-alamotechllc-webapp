import { Timestamp } from "firebase-admin/firestore";
import { TENANT_ZERO } from "@raas/domain";
import { auth, createProviderBinding, firestore, ingestEvent, seedTenantZero } from "@raas/store";

const email = process.env.LOCAL_OPERATOR_EMAIL ?? "operator@alamotechllc.test";
const password = process.env.LOCAL_OPERATOR_PASSWORD ?? "local-dev-only";
const uid = "operator-local";

const env = {
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8280",
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? "demo-raas-cp",
};

const appointment = {
  eventType: "AppointmentBooked",
  occurredAt: "2026-10-23T18:04:05.000Z",
  occurredAtSource: "provider" as const,
  correlationId: "appt_operator_ui_001",
  source: {
    provider: "gohighlevel",
    providerEventId: "appt_operator_ui_001",
    providerAccountId: "loc_operator_ui",
  },
  attributes: {
    providerAppointmentId: "appt_operator_ui_001",
    startAt: "2026-10-24T15:00:00.000Z",
    endAt: "2026-10-24T15:30:00.000Z",
    timezone: "America/Chicago",
    locationType: "video",
  },
};

async function main(): Promise<void> {
  const db = firestore();
  await seedTenantZero(db, env);
  try {
    await auth().createUser({ uid, email, password, emailVerified: true });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code !== "auth/uid-already-exists" && code !== "auth/email-already-exists") throw error;
    await auth().updateUser(uid, { email, password, emailVerified: true });
  }
  await auth().setCustomUserClaims(uid, { raasRole: "operator" });
  await db.doc(`operators/${uid}`).set({ platformRole: "operator", status: "active", hostedDomain: "alamotechllc.com" });
  await db.doc(`operators/${uid}/assignments/${TENANT_ZERO.tenantId}`).set({
    tenantId: TENANT_ZERO.tenantId,
    grantedByUid: "seed",
    grantedAt: Timestamp.now(),
  });
  try {
    await createProviderBinding(db, {
      tenantId: TENANT_ZERO.tenantId,
      serviceInstanceId: TENANT_ZERO.instanceId,
      channel: "calendar",
      provider: "gohighlevel",
      externalAccountId: "loc_operator_ui",
      secretResource: "projects/demo-raas-cp/secrets/raas-local-binding-operator-ui/versions/latest",
      reconcileMode: "webhook_only",
      providerConfig: { calendarId: "cal_operator_ui" },
      actorUid: uid,
      actorRole: "operator",
      requestId: "seed-operator",
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code !== "DUPLICATE_BINDING") throw error;
  }
  if (process.argv.includes("--ingest")) {
    const result = await ingestEvent(db, appointment);
    console.log(JSON.stringify({ ingested: true, replayed: result.replayed, status: result.status }));
    return;
  }
  console.log(JSON.stringify({ operator: email, tenantId: TENANT_ZERO.tenantId }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.name : "seed failed");
  process.exit(1);
});
