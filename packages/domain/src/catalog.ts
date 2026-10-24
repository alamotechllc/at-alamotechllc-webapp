/** Closed Lead Capture catalog for schemaVersion 1. Provider names are not event types. */
export const LEAD_CAPTURE_EVENT_TYPES = [
  "LeadCaptured",
  "InboundCallReceived",
  "InboundCallAnswered",
  "InboundCallMissed",
  "MissedCallRecovered",
  "SmsMessageReceived",
  "SmsMessageSent",
  "EmailMessageReceived",
  "EmailMessageSent",
  "FollowUpAttempted",
  "LeadQualified",
  "LeadDisqualified",
  "HumanEscalationRequested",
  "AppointmentBooked",
  "AppointmentAttended",
  "AppointmentNoShow",
  "OpportunityValued",
] as const;

export type LeadCaptureEventType = (typeof LEAD_CAPTURE_EVENT_TYPES)[number];

/** Milestone 1 ingests this subset. Other catalog types are recognized and rejected. */
export const MILESTONE_EVENT_TYPES = ["AppointmentBooked"] as const;

export type MilestoneEventType = (typeof MILESTONE_EVENT_TYPES)[number];

const CATALOG = new Set<string>(LEAD_CAPTURE_EVENT_TYPES);
const MILESTONE = new Set<string>(MILESTONE_EVENT_TYPES);

export function classifyEventType(eventType: string): "milestone" | "catalog" | "unknown" {
  if (MILESTONE.has(eventType)) return "milestone";
  if (CATALOG.has(eventType)) return "catalog";
  return "unknown";
}
