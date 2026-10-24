import type { AppointmentBookedAttributes } from "@raas/domain";

const LOCATION_TYPES = new Set(["phone", "video", "in_person", "unknown"]);

export interface GhlAppointmentEvent {
  schemaVersion: 1;
  eventType: "AppointmentBooked";
  occurredAt: string;
  occurredAtSource: "provider" | "adapter_received";
  correlationId: string;
  campaignId: null;
  leadId: null;
  source: {
    provider: "gohighlevel";
    providerEventId: string;
    providerAccountId: string;
    upstreamProvider: null;
    upstreamEventId: null;
  };
  attributes: AppointmentBookedAttributes;
}

export type MapResult =
  | { kind: "event"; event: GhlAppointmentEvent }
  | { kind: "ignore" }
  | { kind: "invalid"; issue: "malformed" | "missing" | "account_mismatch" };

/**
 * Translate one GoHighLevel AppointmentCreate webhook into AppointmentBooked.
 * Contact, message, and pipeline fields are ignored. They are not catalog attributes.
 */
export function mapGhlWebhook(payload: unknown, externalAccountId: string, receivedAt: Date): MapResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { kind: "invalid", issue: "malformed" };
  }
  const body = payload as Record<string, unknown>;
  if (typeof body.type !== "string") return { kind: "invalid", issue: "malformed" };
  if (body.type !== "AppointmentCreate") return { kind: "ignore" };
  if (typeof body.locationId === "string" && body.locationId !== externalAccountId) {
    return { kind: "invalid", issue: "account_mismatch" };
  }
  const appointment = body.appointment;
  if (!appointment || typeof appointment !== "object" || Array.isArray(appointment)) {
    return { kind: "invalid", issue: "malformed" };
  }
  const record = appointment as Record<string, unknown>;
  const providerAppointmentId = stringField(record.id);
  const startAt = timestampField(record.startTime);
  const endAt = timestampField(record.endTime);
  const timezone = stringField(record.selectedTimezone) ?? stringField(record.timezone);
  if (!providerAppointmentId || !startAt || !endAt || !timezone) {
    return { kind: "invalid", issue: "missing" };
  }
  const occurredAt = timestampField(body.timestamp) ?? receivedAt.toISOString();
  const locationType = stringField(record.locationType);
  const attributes: AppointmentBookedAttributes = {
    providerAppointmentId,
    startAt,
    endAt,
    timezone,
    ...(locationType && LOCATION_TYPES.has(locationType)
      ? { locationType: locationType as AppointmentBookedAttributes["locationType"] }
      : {}),
  };
  return {
    kind: "event",
    event: {
      schemaVersion: 1,
      eventType: "AppointmentBooked",
      occurredAt,
      occurredAtSource: timestampField(body.timestamp) ? "provider" : "adapter_received",
      correlationId: providerAppointmentId,
      campaignId: null,
      leadId: null,
      source: {
        provider: "gohighlevel",
        providerEventId: providerAppointmentId,
        providerAccountId: externalAccountId,
        upstreamProvider: null,
        upstreamEventId: null,
      },
      attributes,
    },
  };
}

function stringField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function timestampField(value: unknown): string | undefined {
  const text = stringField(value);
  if (!text || Number.isNaN(Date.parse(text))) return undefined;
  return new Date(text).toISOString();
}
