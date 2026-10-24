import { Timestamp, type DocumentData, type Firestore } from "firebase-admin/firestore";
import {
  ApiError,
  bindingIndexId,
  businessEventId,
  canonicalHash,
  newId,
  validateInboundEvent,
  type Attribution,
  type EventSource,
  type InboundEvent,
} from "@raas/domain";
import { tenantCollection, tenantDoc, tenantRoot } from "./tenantDb.js";

export interface IngestSuccess {
  status: 200 | 201;
  eventId: string;
  leadId: string | null;
  replayed: boolean;
  receiptId: null;
  tenantId: string;
}

export async function ingestEvent(db: Firestore, command: InboundEvent): Promise<IngestSuccess> {
  const attributes = validateInboundEvent(command);
  const provider = command.source.provider;
  const externalAccountId = command.source.providerAccountId;
  const index = await db.doc(`providerBindingIndex/${bindingIndexId(provider, externalAccountId)}`).get();
  if (!index.exists || index.data()?.status !== "active") {
    throw new ApiError(404, "BINDING_UNKNOWN", "Provider binding was not found.");
  }
  const tenantId = String(index.data()?.tenantId);
  const bindingId = String(index.data()?.bindingId);
  const serviceInstanceId = String(index.data()?.serviceInstanceId);
  if (command.tenantId && command.tenantId !== tenantId) {
    throw new ApiError(422, "TENANT_MISMATCH", "Tenant does not match the provider binding.");
  }

  const tenant = await tenantRoot(db, tenantId).get();
  if (tenant.data()?.status === "suspended") {
    throw new ApiError(409, "TENANT_SUSPENDED", "Tenant is suspended.");
  }
  const instance = await tenantDoc(db, tenantId, "serviceInstances", serviceInstanceId).get();
  if (instance.data()?.status !== "active") {
    throw new ApiError(409, "INSTANCE_NOT_ACTIVE", "Service instance is not active.");
  }

  const binding = await tenantDoc(db, tenantId, "providerBindings", bindingId).get();
  const resolved = await resolveCampaign(
    db,
    tenantId,
    serviceInstanceId,
    command.campaignId ?? null,
    binding.data()?.defaultCampaignId,
  );

  const source: EventSource = {
    provider,
    providerEventId: command.source.providerEventId,
    providerAccountId: externalAccountId,
    bindingId,
    upstreamProvider: command.source.upstreamProvider ?? null,
    upstreamEventId: command.source.upstreamEventId ?? null,
  };
  const eventId = businessEventId({
    tenantId,
    provider: source.provider,
    providerEventId: source.providerEventId,
    upstreamProvider: source.upstreamProvider,
    upstreamEventId: source.upstreamEventId,
  });
  const eventRef = tenantDoc(db, tenantId, "businessEvents", eventId);

  const hashFor = (leadId: string | null) =>
    canonicalHash({
      eventType: command.eventType,
      occurredAt: command.occurredAt,
      tenantId,
      serviceInstanceId,
      campaignId: resolved.campaignId,
      leadId,
      correlationId: command.correlationId,
      source,
      attributes: { ...attributes },
    });

  const existing = await eventRef.get();
  if (existing.exists) {
    return finishExisting(db, tenantId, eventId, existing.data(), hashFor);
  }

  const suppliedLeadId = command.leadId ?? null;
  const leadId = suppliedLeadId ?? newId("led");
  const creatingLead = !suppliedLeadId;
  const appointmentId = newId("apt");
  const recordedAt = new Date();
  const hash = hashFor(leadId);
  const occurredAt = Timestamp.fromDate(new Date(command.occurredAt));

  const outcome = await db.runTransaction(async (tx) => {
    const current = await tx.get(eventRef);
    if (current.exists) {
      const storedLead = (current.data()?.leadId ?? null) as string | null;
      if (current.data()?.canonicalHash === hashFor(storedLead)) {
        return { kind: "replayed" as const, leadId: storedLead };
      }
      return { kind: "conflict" as const };
    }
    if (suppliedLeadId) {
      const lead = await tx.get(tenantDoc(db, tenantId, "leads", suppliedLeadId));
      if (!lead.exists || lead.data()?.mergedInto) {
        throw new ApiError(422, "LEAD_REQUIRED", "leadId does not match an open lead.");
      }
    } else {
      tx.set(tenantDoc(db, tenantId, "leads", leadId), {
        leadId,
        tenantId,
        serviceInstanceId,
        status: "open",
        emails: [],
        phones: [],
        escalationOpen: false,
        campaignId: resolved.campaignId,
        createdAt: occurredAt,
        updatedAt: Timestamp.now(),
      });
    }
    tx.set(tenantDoc(db, tenantId, "appointments", appointmentId), {
      appointmentId,
      tenantId,
      serviceInstanceId,
      leadId,
      campaignId: resolved.campaignId,
      status: "booked",
      startAt: Timestamp.fromDate(new Date(attributes.startAt)),
      endAt: Timestamp.fromDate(new Date(attributes.endAt)),
      timezone: attributes.timezone,
      provider: source.provider,
      providerAppointmentId: attributes.providerAppointmentId,
      bookedEventId: eventId,
    });
    tx.set(db.doc(`appointmentIndex/${tenantId}__${source.provider}__${attributes.providerAppointmentId}`), {
      tenantId,
      provider: source.provider,
      providerAppointmentId: attributes.providerAppointmentId,
      appointmentId,
    });
    tx.set(eventRef, {
      schemaVersion: 1,
      eventId,
      eventType: command.eventType,
      occurredAt,
      occurredAtSource: command.occurredAtSource,
      recordedAt: Timestamp.fromDate(recordedAt),
      tenantId,
      serviceInstanceId,
      campaignId: resolved.campaignId,
      attribution: resolved.attribution,
      leadId,
      leadCreated: creatingLead,
      correlationId: command.correlationId,
      source,
      attributes,
      canonicalHash: hash,
      receiptId: null,
    });
    return { kind: "created" as const, leadId };
  });

  if (outcome.kind === "conflict") {
    await writeConflict(db, tenantId);
    throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "Provider event id was already stored with a different payload.");
  }
  if (outcome.kind === "replayed") {
    return { status: 200, eventId, leadId: outcome.leadId, replayed: true, receiptId: null, tenantId };
  }
  return { status: 201, eventId, leadId: outcome.leadId, replayed: false, receiptId: null, tenantId };
}

async function finishExisting(
  db: Firestore,
  tenantId: string,
  eventId: string,
  data: DocumentData | undefined,
  hashFor: (leadId: string | null) => string,
): Promise<IngestSuccess> {
  const leadId = (data?.leadId ?? null) as string | null;
  if (data?.canonicalHash === hashFor(leadId)) {
    return { status: 200, eventId, leadId, replayed: true, receiptId: null, tenantId };
  }
  await writeConflict(db, tenantId);
  throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "Provider event id was already stored with a different payload.");
}

async function writeConflict(db: Firestore, tenantId: string): Promise<void> {
  const letterId = newId("dlq");
  await tenantDoc(db, tenantId, "deadLetters", letterId).set({
    letterId,
    tenantId,
    source: "ingress",
    reasonCode: "idempotency_conflict",
    attempts: 1,
    status: "open",
    firstSeenAt: Timestamp.now(),
    lastSeenAt: Timestamp.now(),
    summary: "Same provider event id arrived with a different canonical payload.",
  });
}

async function resolveCampaign(
  db: Firestore,
  tenantId: string,
  serviceInstanceId: string,
  requested: string | null,
  defaultCampaignId: unknown,
): Promise<{ campaignId: string | null; attribution: Attribution }> {
  if (requested) {
    const campaign = await tenantDoc(db, tenantId, "campaigns", requested).get();
    if (!campaign.exists || campaign.data()?.serviceInstanceId !== serviceInstanceId) {
      throw new ApiError(422, "VALIDATION_FAILED", "Campaign does not belong to this service instance.", [
        { field: "campaignId", issue: "unknown" },
      ]);
    }
    return { campaignId: requested, attribution: "explicit" };
  }
  if (typeof defaultCampaignId === "string" && defaultCampaignId) {
    return { campaignId: defaultCampaignId, attribution: "binding_default" };
  }
  return { campaignId: null, attribution: "unknown" };
}

export async function countTenantAppointments(db: Firestore, tenantId: string): Promise<number> {
  const snap = await tenantCollection(db, tenantId, "appointments").get();
  return snap.size;
}
