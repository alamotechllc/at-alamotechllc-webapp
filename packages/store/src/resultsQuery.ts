import { Timestamp, type Firestore } from "firebase-admin/firestore";
import {
  ApiError,
  computeLeadCaptureResults,
  DEFAULT_METRIC_POLICY,
  METRIC_POLICY_VERSION,
  type ResultEvent,
} from "@raas/domain";
import { tenantCollection, tenantDoc, tenantRoot } from "./tenantDb.js";

export async function queryResults(
  db: Firestore,
  tenantId: string,
  serviceInstanceId: string,
  from: string,
  to: string,
): Promise<{
  metricPolicyVersion: string;
  generatedAt: string;
  metrics: ReturnType<typeof computeLeadCaptureResults>;
}> {
  const instance = await tenantDoc(db, tenantId, "serviceInstances", serviceInstanceId).get();
  if (!instance.exists) {
    throw new ApiError(404, "NOT_FOUND", "Service instance was not found.");
  }
  const snap = await tenantCollection(db, tenantId, "businessEvents").get();
  const events: ResultEvent[] = snap.docs.flatMap((doc) => {
    const data = doc.data();
    if (data.serviceInstanceId !== serviceInstanceId) return [];
    return [{
      eventType: String(data.eventType),
      occurredAt: (data.occurredAt as Timestamp).toDate().toISOString(),
      recordedAt: (data.recordedAt as Timestamp).toDate().toISOString(),
      leadId: (data.leadId ?? null) as string | null,
      correlationId: String(data.correlationId),
      attribution: String(data.attribution ?? "unknown"),
      leadCreated: Boolean(data.leadCreated),
      attributes: (data.attributes ?? {}) as Record<string, unknown>,
    }];
  });
  const policy = instance.data()?.metricPolicy ?? DEFAULT_METRIC_POLICY;
  const tenant = await tenantRoot(db, tenantId).get();
  return {
    metricPolicyVersion: String(instance.data()?.metricPolicyVersion ?? METRIC_POLICY_VERSION),
    generatedAt: new Date().toISOString(),
    metrics: computeLeadCaptureResults(events, policy, {
      periodStart: new Date(from).toISOString(),
      periodEnd: new Date(to).toISOString(),
      timezone: String(tenant.data()?.timezone ?? "America/Chicago"),
    }),
  };
}
