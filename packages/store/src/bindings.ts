import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { ApiError, bindingIndexId, newId, type BindingChannel, type ReconcileMode } from "@raas/domain";
import { tenantDoc } from "./tenantDb.js";

export interface CreateBindingInput {
  tenantId: string;
  serviceInstanceId: string;
  channel: BindingChannel;
  provider: string;
  externalAccountId: string;
  secretResource: string;
  defaultCampaignId?: string;
  bindingId?: string;
  reconcileMode?: ReconcileMode;
  providerConfig?: { calendarId?: string };
  actorUid: string;
  actorRole: string;
  requestId: string;
}

export async function assertBindingAvailable(db: Firestore, provider: string, externalAccountId: string): Promise<void> {
  const index = await db.doc(`providerBindingIndex/${bindingIndexId(provider, externalAccountId)}`).get();
  if (index.exists && index.data()?.status === "active") {
    throw new ApiError(409, "DUPLICATE_BINDING", "This provider account is already bound.");
  }
}

export interface ResolvedBinding {
  bindingId: string;
  tenantId: string;
  serviceInstanceId: string;
  status: "active";
  secretResource: string;
  defaultCampaignId: string | null;
  routes: [];
  reconcileMode: ReconcileMode;
  providerConfig: { calendarId?: string };
}

export async function resolveProviderBinding(
  db: Firestore,
  provider: string,
  externalAccountId: string,
): Promise<ResolvedBinding> {
  if (!provider || !externalAccountId) {
    throw new ApiError(422, "VALIDATION_FAILED", "provider and externalAccountId are required.");
  }
  const index = await db.doc(`providerBindingIndex/${bindingIndexId(provider, externalAccountId)}`).get();
  if (!index.exists || index.data()?.status !== "active") {
    throw new ApiError(404, "BINDING_UNKNOWN", "Provider binding was not found.");
  }
  const tenantId = String(index.data()?.tenantId);
  const bindingId = String(index.data()?.bindingId);
  const serviceInstanceId = String(index.data()?.serviceInstanceId);
  const binding = await tenantDoc(db, tenantId, "providerBindings", bindingId).get();
  if (!binding.exists || binding.data()?.status !== "active") {
    throw new ApiError(404, "BINDING_UNKNOWN", "Provider binding was not found.");
  }
  const data = binding.data() ?? {};
  const calendarId = data.providerConfig && typeof data.providerConfig.calendarId === "string"
    ? data.providerConfig.calendarId
    : undefined;
  return {
    bindingId,
    tenantId,
    serviceInstanceId,
    status: "active",
    secretResource: String(data.secretResource ?? ""),
    defaultCampaignId: typeof data.defaultCampaignId === "string" ? data.defaultCampaignId : null,
    routes: [],
    reconcileMode: data.reconcileMode === "pull" ? "pull" : "webhook_only",
    providerConfig: calendarId ? { calendarId } : {},
  };
}

export async function createProviderBinding(db: Firestore, input: CreateBindingInput): Promise<{ bindingId: string }> {
  if ("secretValue" in input) {
    throw new ApiError(422, "VALIDATION_FAILED", "secretValue is not stored on the binding.");
  }
  const instance = await tenantDoc(db, input.tenantId, "serviceInstances", input.serviceInstanceId).get();
  if (!instance.exists || instance.data()?.status !== "active" || instance.data()?.productCode !== "lead-capture") {
    throw new ApiError(404, "NOT_FOUND", "Active Lead Capture service instance was not found.");
  }
  await assertBindingAvailable(db, input.provider, input.externalAccountId);
  const bindingId = input.bindingId ?? newId("bnd");
  const indexId = bindingIndexId(input.provider, input.externalAccountId);
  const auditId = newId("aud");
  await tenantDoc(db, input.tenantId, "providerBindings", bindingId).set({
    bindingId,
    tenantId: input.tenantId,
    serviceInstanceId: input.serviceInstanceId,
    channel: input.channel,
    provider: input.provider,
    externalAccountId: input.externalAccountId,
    secretResource: input.secretResource,
    ...(input.defaultCampaignId ? { defaultCampaignId: input.defaultCampaignId } : {}),
    reconcileMode: input.reconcileMode ?? "webhook_only",
    ...(input.providerConfig ? { providerConfig: input.providerConfig } : {}),
    status: "active",
    createdAt: Timestamp.now(),
  });
  await db.doc(`providerBindingIndex/${indexId}`).set({
    provider: input.provider,
    externalAccountId: input.externalAccountId,
    tenantId: input.tenantId,
    bindingId,
    serviceInstanceId: input.serviceInstanceId,
    status: "active",
  });
  await tenantDoc(db, input.tenantId, "auditEvents", auditId).set({
    auditId,
    tenantId: input.tenantId,
    actorUid: input.actorUid,
    actorRole: input.actorRole,
    action: "binding.create",
    target: { type: "providerBinding", id: bindingId },
    occurredAt: Timestamp.now(),
    requestId: input.requestId,
  });
  return { bindingId };
}
