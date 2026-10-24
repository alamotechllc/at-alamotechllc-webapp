export interface MetricPolicy {
  recoveryWindowHours: number;
  businessHours: {
    days: number[];
    start: string;
    end: string;
  };
  valueBasis: "estimate";
}

export interface ResultEvent {
  eventType: string;
  occurredAt: string;
  recordedAt: string;
  leadId: string | null;
  correlationId: string;
  attribution: string;
  leadCreated?: boolean;
  attributes: Record<string, unknown>;
}

export interface MetricValue {
  value: number | null;
  unit: string;
  notes?: string;
}

export interface ResultWindow {
  periodStart: string;
  periodEnd: string;
  timezone: string;
}

const CREATING_TYPES = new Set([
  "LeadCaptured",
  "InboundCallReceived",
  "SmsMessageReceived",
  "EmailMessageReceived",
  "AppointmentBooked",
]);

const INBOUND_TYPES = new Set([
  "InboundCallReceived",
  "SmsMessageReceived",
  "EmailMessageReceived",
]);

const OUTBOUND_TYPES = new Set([
  "SmsMessageSent",
  "EmailMessageSent",
  "FollowUpAttempted",
  "InboundCallAnswered",
]);

export function computeLeadCaptureResults(
  events: ResultEvent[],
  policy: MetricPolicy,
  window: ResultWindow,
): Record<string, MetricValue> {
  const start = Date.parse(window.periodStart);
  const end = Date.parse(window.periodEnd);
  const inWindow = events.filter((event) => {
    const at = Date.parse(event.occurredAt);
    return at >= start && at < end;
  });

  const callsReceived = distinct(inWindow, "InboundCallReceived", "callId");
  const receivedBeforeEnd = new Set(
    events
      .filter((event) => event.eventType === "InboundCallReceived" && Date.parse(event.occurredAt) < end)
      .map((event) => String(event.attributes.callId)),
  );
  const answeredIds = inWindow
    .filter((event) => event.eventType === "InboundCallAnswered")
    .map((event) => String(event.attributes.callId))
    .filter((id) => receivedBeforeEnd.has(id));
  const callsAnswered = new Set(answeredIds).size;

  const missedByCall = new Map<string, string>();
  for (const event of events) {
    if (event.eventType === "InboundCallMissed" && event.attributes.callId) {
      missedByCall.set(String(event.attributes.callId), event.occurredAt);
    }
  }
  const recovered = new Set<string>();
  for (const event of inWindow) {
    if (event.eventType !== "MissedCallRecovered") continue;
    const callId = String(event.attributes.callId);
    const missedAt = missedByCall.get(callId);
    const recoveredAt = String(event.attributes.recoveredAt ?? "");
    if (!missedAt || !recoveredAt) continue;
    const deltaHours = (Date.parse(recoveredAt) - Date.parse(missedAt)) / 36e5;
    if (deltaHours >= 0 && deltaHours <= policy.recoveryWindowHours) recovered.add(callId);
  }

  const leadIds = new Set<string>();
  for (const event of inWindow) {
    if (!event.leadId) continue;
    if (event.leadCreated || event.eventType === "LeadCaptured") {
      if (CREATING_TYPES.has(event.eventType) || event.eventType === "LeadCaptured") leadIds.add(event.leadId);
    }
  }

  const qualified = new Set<string>();
  const disqualified = new Set<string>();
  const leadIdsInPlay = new Set(events.map((event) => event.leadId).filter((id): id is string => Boolean(id)));
  for (const leadId of leadIdsInPlay) {
    const decision = latestQualification(events, leadId, end);
    if (!decision) continue;
    const at = Date.parse(decision.occurredAt);
    if (at < start || at >= end) continue;
    if (decision.eventType === "LeadQualified") qualified.add(leadId);
    if (decision.eventType === "LeadDisqualified") disqualified.add(leadId);
  }

  const appointmentsBooked = inWindow.filter((event) => event.eventType === "AppointmentBooked").length;
  const appointmentAttendance = inWindow.filter((event) => event.eventType === "AppointmentAttended").length;
  const appointmentNoShow = inWindow.filter((event) => event.eventType === "AppointmentNoShow").length;
  const attendanceDenom = appointmentAttendance + appointmentNoShow;

  const responseSamples = responseSamplesFor(events.filter((event) => Date.parse(event.occurredAt) < end));
  const inWindowSamples = responseSamples.filter((sample) => sample.outboundAt >= start && sample.outboundAt < end);

  const value = estimatedValue(inWindow);

  return {
    callsReceived: count(callsReceived),
    callsAnswered: count(callsAnswered),
    callsAnsweredRate: ratio(callsReceived === 0 ? null : callsAnswered / callsReceived),
    missedCalls: count(distinct(inWindow, "InboundCallMissed", "callId")),
    callsRecovered: count(recovered.size),
    leadsCreated: count(leadIds.size),
    qualifiedLeads: count(qualified.size),
    disqualifiedLeads: count(disqualified.size),
    appointmentsBooked: count(appointmentsBooked),
    appointmentAttendance: count(appointmentAttendance),
    appointmentNoShow: count(appointmentNoShow),
    appointmentAttendanceRate: ratio(attendanceDenom === 0 ? null : appointmentAttendance / attendanceDenom),
    humanEscalations: count(inWindow.filter((event) => event.eventType === "HumanEscalationRequested").length),
    smsConversations: count(distinct(inWindow.filter((event) => event.eventType.startsWith("Sms")), undefined, "conversationId")),
    emailConversations: count(
      distinct(inWindow.filter((event) => event.eventType.startsWith("Email")), undefined, "conversationId"),
    ),
    followUpAttempts: count(inWindow.filter((event) => event.eventType === "FollowUpAttempted").length),
    responseTimeMedianSeconds: seconds(median(inWindowSamples.map((sample) => sample.clockSeconds))),
    responseTimeMedianBusinessSeconds: seconds(
      median(inWindowSamples.map((sample) => businessSeconds(sample.inboundAt, sample.outboundAt, window.timezone, policy))),
    ),
    unknownCampaignEvents: count(inWindow.filter((event) => event.attribution === "unknown").length),
    estimatedOpportunityValueMinor: value,
  };
}

function distinct(events: ResultEvent[], eventType: string | undefined, attribute: string): number {
  const ids = new Set<string>();
  for (const event of events) {
    if (eventType && event.eventType !== eventType) continue;
    const value = event.attributes[attribute];
    if (typeof value === "string" && value) ids.add(value);
  }
  return ids.size;
}

function latestQualification(events: ResultEvent[], leadId: string, periodEnd: number): ResultEvent | null {
  const relevant = events
    .filter((event) => {
      if (event.leadId !== leadId) return false;
      if (event.eventType !== "LeadQualified" && event.eventType !== "LeadDisqualified") return false;
      return Date.parse(event.occurredAt) < periodEnd;
    })
    .sort((a, b) => {
      const occurred = Date.parse(a.occurredAt) - Date.parse(b.occurredAt);
      if (occurred !== 0) return occurred;
      return Date.parse(a.recordedAt) - Date.parse(b.recordedAt);
    });
  return relevant.at(-1) ?? null;
}

function responseSamplesFor(events: ResultEvent[]): { inboundAt: number; outboundAt: number; clockSeconds: number }[] {
  const byCorrelation = new Map<string, ResultEvent[]>();
  for (const event of events) {
    const list = byCorrelation.get(event.correlationId) ?? [];
    list.push(event);
    byCorrelation.set(event.correlationId, list);
  }
  const samples = [];
  for (const list of byCorrelation.values()) {
    const inbound = list
      .filter((event) => INBOUND_TYPES.has(event.eventType))
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))[0];
    const outbound = list
      .filter((event) => OUTBOUND_TYPES.has(event.eventType))
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))[0];
    if (!inbound || !outbound) continue;
    const inboundAt = Date.parse(inbound.occurredAt);
    const outboundAt = Date.parse(outbound.occurredAt);
    if (outboundAt < inboundAt) continue;
    samples.push({ inboundAt, outboundAt, clockSeconds: (outboundAt - inboundAt) / 1000 });
  }
  return samples;
}

function estimatedValue(events: ResultEvent[]): MetricValue {
  const latest = new Map<string, ResultEvent>();
  for (const event of events) {
    if (event.eventType !== "OpportunityValued" || !event.leadId) continue;
    if (event.attributes.basis !== "estimate") continue;
    const current = latest.get(event.leadId);
    if (!current || compareEvents(event, current) > 0) latest.set(event.leadId, event);
  }
  const currencies = new Set([...latest.values()].map((event) => String(event.attributes.currency)));
  if (currencies.size > 1) {
    return { value: null, unit: "minor", notes: "mixed_currency" };
  }
  let sum = 0;
  for (const event of latest.values()) sum += Number(event.attributes.amountMinor ?? 0);
  return { value: sum, unit: "minor" };
}

function compareEvents(a: ResultEvent, b: ResultEvent): number {
  const occurred = Date.parse(a.occurredAt) - Date.parse(b.occurredAt);
  if (occurred !== 0) return occurred;
  return Date.parse(a.recordedAt) - Date.parse(b.recordedAt);
}

export function businessSeconds(startMs: number, endMs: number, timeZone: string, policy: MetricPolicy): number {
  if (endMs <= startMs) return 0;
  const [startHour, startMinute] = policy.businessHours.start.split(":").map(Number);
  const [endHour, endMinute] = policy.businessHours.end.split(":").map(Number);
  const days = new Set(policy.businessHours.days);
  const startParts = zonedParts(new Date(startMs), timeZone);
  const endParts = zonedParts(new Date(endMs), timeZone);
  let year = startParts.year;
  let month = startParts.month;
  let day = startParts.day;
  const endKey = endParts.year * 10000 + endParts.month * 100 + endParts.day;
  let total = 0;
  for (let guard = 0; guard < 400; guard += 1) {
    const key = year * 10000 + month * 100 + day;
    if (key > endKey) break;
    const noon = zonedTimeToUtc({ year, month, day, hour: 12, minute: 0, second: 0 }, timeZone);
    if (days.has(zonedParts(noon, timeZone).weekday)) {
      const open = zonedTimeToUtc({ year, month, day, hour: startHour, minute: startMinute, second: 0 }, timeZone);
      const close = zonedTimeToUtc({ year, month, day, hour: endHour, minute: endMinute, second: 0 }, timeZone);
      const overlapStart = Math.max(startMs, open.getTime());
      const overlapEnd = Math.min(endMs, close.getTime());
      if (overlapEnd > overlapStart) total += (overlapEnd - overlapStart) / 1000;
    }
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = next.getUTCDate();
  }
  return total;
}

interface Civil {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday?: number;
}

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(date: Date, timeZone: string): Required<Civil> {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY[parts.weekday] ?? 0,
  };
}

export function zonedTimeToUtc(civil: Civil, timeZone: string): Date {
  const wallAsUtc = Date.UTC(civil.year, civil.month - 1, civil.day, civil.hour, civil.minute, civil.second);
  let utc = wallAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(new Date(utc), timeZone);
    const offset = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - utc;
    const next = wallAsUtc - offset;
    if (next === utc) break;
    utc = next;
  }
  return new Date(utc);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function count(value: number): MetricValue {
  return { value, unit: "count" };
}

function ratio(value: number | null): MetricValue {
  return { value, unit: "ratio" };
}

function seconds(value: number | null): MetricValue {
  return { value, unit: "seconds" };
}
