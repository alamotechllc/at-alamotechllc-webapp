import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import {
  TENANT_ZERO,
  DEFAULT_METRIC_POLICY,
  DEFAULT_RETENTION,
  METRIC_POLICY_VERSION,
  TENANT_ZERO_POC_MEMBER_UID,
  tenantZeroCustomerActions,
} from "@raas/domain";
import { assertDevelopmentSeedAllowed } from "./seedGuard.js";
import { tenantDoc, tenantRoot } from "./tenantDb.js";

export async function seedTenantZero(db: Firestore, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  assertDevelopmentSeedAllowed(env);
  const now = FieldValue.serverTimestamp();
  await db.doc("raasProducts/lead-capture").set(
    {
      code: "lead-capture",
      name: "Lead Capture RaaS",
      outcome:
        "Capture, qualify, follow up with, and book inbound opportunities that a client might otherwise lose.",
      status: "active",
      metricPolicyVersion: METRIC_POLICY_VERSION,
      eventTypes: ["AppointmentBooked"],
    },
    { merge: true },
  );

  await tenantRoot(db, TENANT_ZERO.tenantId).set(
    {
      tenantId: TENANT_ZERO.tenantId,
      legalName: TENANT_ZERO.legalName,
      status: "active",
      createdAt: now,
      createdByUid: "seed",
      timezone: TENANT_ZERO.timezone,
      retention: DEFAULT_RETENTION,
    },
    { merge: true },
  );

  await tenantDoc(db, TENANT_ZERO.tenantId, "serviceInstances", TENANT_ZERO.instanceId).set(
    {
      instanceId: TENANT_ZERO.instanceId,
      tenantId: TENANT_ZERO.tenantId,
      productCode: TENANT_ZERO.productCode,
      status: "active",
      metricPolicyVersion: METRIC_POLICY_VERSION,
      metricPolicy: DEFAULT_METRIC_POLICY,
      activatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  await tenantDoc(db, TENANT_ZERO.tenantId, "members", TENANT_ZERO_POC_MEMBER_UID).set(
    {
      role: "tenant_admin",
      status: "active",
    },
    { merge: true },
  );

  for (const action of tenantZeroCustomerActions()) {
    await tenantDoc(db, TENANT_ZERO.tenantId, "actions", action.id).set(
      {
        actionId: action.id,
        tenantId: action.tenantId,
        title: action.title,
        description: action.description ?? null,
        assignedTo: action.assignedTo,
        priority: action.priority,
        actionLabel: action.actionLabel ?? null,
        actionUrl: action.actionUrl ?? null,
        createdAt: action.createdAt,
      },
      { merge: true },
    );
  }

  const auditId = `aud_seed_${TENANT_ZERO.tenantId}`;
  await tenantDoc(db, TENANT_ZERO.tenantId, "auditEvents", auditId).set({
    auditId,
    tenantId: TENANT_ZERO.tenantId,
    actorUid: "seed",
    actorRole: "platform_admin",
    action: "tenant.create",
    target: { type: "tenant", id: TENANT_ZERO.tenantId },
    occurredAt: Timestamp.now(),
    requestId: "seed",
  });
}
