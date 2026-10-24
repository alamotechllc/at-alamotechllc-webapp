import { sha256Hex } from "./ids.js";

export interface EventSource {
  provider: string;
  providerEventId: string;
  providerAccountId: string;
  bindingId: string;
  upstreamProvider?: string | null;
  upstreamEventId?: string | null;
}

export interface CanonicalInput {
  eventType: string;
  occurredAt: string;
  tenantId: string;
  serviceInstanceId: string;
  campaignId: string | null;
  leadId: string | null;
  correlationId: string;
  source: EventSource;
  attributes: Record<string, unknown>;
}

export function toIsoMillis(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid timestamp");
  }
  return date.toISOString();
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const item = record[key];
      if (item !== undefined) sorted[key] = sortValue(item);
    }
    return sorted;
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

/** Hash after lead resolution. Excludes eventId, recordedAt, receiptId, and attribution. */
export function canonicalHash(input: CanonicalInput): string {
  const payload = {
    schemaVersion: 1,
    eventType: input.eventType,
    occurredAt: toIsoMillis(input.occurredAt),
    tenantId: input.tenantId,
    serviceInstanceId: input.serviceInstanceId,
    campaignId: input.campaignId,
    leadId: input.leadId,
    correlationId: input.correlationId,
    source: {
      provider: input.source.provider,
      providerEventId: input.source.providerEventId,
      providerAccountId: input.source.providerAccountId,
      bindingId: input.source.bindingId,
      upstreamProvider: input.source.upstreamProvider ?? null,
      upstreamEventId: input.source.upstreamEventId ?? null,
    },
    attributes: input.attributes,
  };
  return sha256Hex(stableStringify(payload));
}
