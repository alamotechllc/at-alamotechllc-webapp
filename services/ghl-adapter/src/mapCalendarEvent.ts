import type { AppointmentBookedAttributes } from "@raas/domain";
import { type GhlAppointmentEvent, type MapResult } from "./mapAppointment.js";

const LOCATION_TYPES = new Set(["phone", "video", "in_person", "unknown"]);

/**
 * Translate one GoHighLevel calendar event into AppointmentBooked.
 * Contact, title, notes, and address are not catalog attributes and are dropped.
 */
export function mapCalendarEvent(
  row: unknown,
  externalAccountId: string,
  calendarTimezone: string,
): MapResult {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return { kind: "invalid", issue: "malformed" };
  }
  const record = row as Record<string, unknown>;
  if (record.deleted === true) return { kind: "ignore" };
  if (typeof record.locationId === "string" && record.locationId !== externalAccountId) {
    return { kind: "invalid", issue: "account_mismatch" };
  }
  const providerAppointmentId = stringField(record.id);
  const startAt = instant(record.startTime);
  const endAt = instant(record.endTime);
  const timezone = iana(stringField(record.selectedTimezone) ?? stringField(record.timezone))
    ?? iana(calendarTimezone);
  if (!providerAppointmentId || !startAt || !endAt || !timezone || Date.parse(endAt) <= Date.parse(startAt)) {
    return { kind: "invalid", issue: "missing" };
  }
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
  const event: GhlAppointmentEvent = {
    schemaVersion: 1,
    eventType: "AppointmentBooked",
    occurredAt: startAt,
    occurredAtSource: "provider",
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
  };
  return { kind: "event", event };
}

function stringField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function instant(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  const text = stringField(value);
  if (!text || Number.isNaN(Date.parse(text))) return undefined;
  return new Date(text).toISOString();
}

function iana(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return undefined;
  }
}
