import { validateAppointmentBookedAttributes, type AppointmentBookedAttributes } from "./appointment.js";
import { classifyEventType } from "./catalog.js";
import { ApiError } from "./errors.js";
import type { EventSource } from "./canonical.js";

export interface InboundEvent {
  eventType: string;
  occurredAt: string;
  occurredAtSource: "provider" | "adapter_received";
  correlationId: string;
  campaignId?: string | null;
  leadId?: string | null;
  tenantId?: string | null;
  source: Omit<EventSource, "bindingId"> & { bindingId?: string };
  attributes: Record<string, unknown>;
}

export function validateInboundEvent(event: InboundEvent): AppointmentBookedAttributes {
  if (!event.occurredAt || Number.isNaN(Date.parse(event.occurredAt))) {
    throw new ApiError(422, "VALIDATION_FAILED", "occurredAt must be an ISO timestamp.", [
      { field: "occurredAt", issue: "invalid_timestamp" },
    ]);
  }
  if (event.occurredAtSource !== "provider" && event.occurredAtSource !== "adapter_received") {
    throw new ApiError(422, "VALIDATION_FAILED", "occurredAtSource is invalid.", [
      { field: "occurredAtSource", issue: "invalid" },
    ]);
  }
  if (!event.correlationId || event.correlationId.length > 500) {
    throw new ApiError(422, "VALIDATION_FAILED", "correlationId is required.", [
      { field: "correlationId", issue: "required" },
    ]);
  }
  const source = event.source;
  if (!source?.provider || !/^[a-z0-9_-]+$/.test(source.provider)) {
    throw new ApiError(422, "VALIDATION_FAILED", "source.provider must be a slug.", [
      { field: "source.provider", issue: "invalid" },
    ]);
  }
  if (!source.providerEventId || !source.providerAccountId) {
    throw new ApiError(422, "VALIDATION_FAILED", "source provider ids are required.", [
      { field: "source", issue: "required" },
    ]);
  }
  const kind = classifyEventType(event.eventType);
  if (kind === "unknown") {
    throw new ApiError(422, "UNKNOWN_EVENT_TYPE", "Event type is not in the Lead Capture catalog.", [
      { field: "eventType", issue: "unknown" },
    ]);
  }
  if (kind === "catalog") {
    throw new ApiError(422, "EVENT_TYPE_NOT_IN_MILESTONE", "Milestone 1 accepts only AppointmentBooked.", [
      { field: "eventType", issue: "not_in_milestone" },
    ]);
  }
  return validateAppointmentBookedAttributes(event.attributes ?? {});
}
