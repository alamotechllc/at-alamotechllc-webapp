import { ApiError } from "./errors.js";

const ALLOWED_ATTRIBUTES = new Set([
  "providerAppointmentId",
  "startAt",
  "endAt",
  "timezone",
  "locationType",
]);

const LOCATION_TYPES = new Set(["phone", "video", "in_person", "unknown"]);

export interface AppointmentBookedAttributes {
  providerAppointmentId: string;
  startAt: string;
  endAt: string;
  timezone: string;
  locationType?: "phone" | "video" | "in_person" | "unknown";
}

export function validateAppointmentBookedAttributes(
  attributes: Record<string, unknown>,
): AppointmentBookedAttributes {
  for (const key of Object.keys(attributes)) {
    if (!ALLOWED_ATTRIBUTES.has(key)) {
      throw new ApiError(422, "UNKNOWN_ATTRIBUTE", "Unknown attribute.", [
        { field: `attributes.${key}`, issue: "unknown" },
      ]);
    }
  }

  const providerAppointmentId = requireString(attributes, "providerAppointmentId");
  const startAt = requireTimestamp(attributes, "startAt");
  const endAt = requireTimestamp(attributes, "endAt");
  const timezone = requireString(attributes, "timezone");
  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    throw new ApiError(422, "VALIDATION_FAILED", "endAt must be after startAt.", [
      { field: "attributes.endAt", issue: "not_after_start" },
    ]);
  }
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new ApiError(422, "VALIDATION_FAILED", "timezone must be an IANA name.", [
      { field: "attributes.timezone", issue: "invalid_timezone" },
    ]);
  }

  const locationType = attributes.locationType;
  if (locationType !== undefined) {
    if (typeof locationType !== "string" || !LOCATION_TYPES.has(locationType)) {
      throw new ApiError(422, "VALIDATION_FAILED", "locationType is invalid.", [
        { field: "attributes.locationType", issue: "invalid" },
      ]);
    }
  }

  return {
    providerAppointmentId,
    startAt,
    endAt,
    timezone,
    ...(locationType ? { locationType: locationType as AppointmentBookedAttributes["locationType"] } : {}),
  };
}

function requireString(attributes: Record<string, unknown>, key: string): string {
  const value = attributes[key];
  if (typeof value !== "string" || value.trim() === "" || value.length > 500) {
    throw new ApiError(422, "VALIDATION_FAILED", `${key} is required.`, [
      { field: `attributes.${key}`, issue: "required" },
    ]);
  }
  return value;
}

function requireTimestamp(attributes: Record<string, unknown>, key: string): string {
  const value = requireString(attributes, key);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(422, "VALIDATION_FAILED", `${key} must be an ISO timestamp.`, [
      { field: `attributes.${key}`, issue: "invalid_timestamp" },
    ]);
  }
  return date.toISOString();
}
