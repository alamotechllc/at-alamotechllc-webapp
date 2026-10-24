export interface MetricDefinition {
  key: string;
  label: string;
}

/** Approved Lead Capture metrics. Only keys in CONFIGURED_METRICS have a live capture path. */
export const LEAD_CAPTURE_METRICS: MetricDefinition[] = [
  { key: "callsReceived", label: "Calls Received" },
  { key: "callsAnswered", label: "Calls Answered" },
  { key: "missedCalls", label: "Calls Missed" },
  { key: "callsRecovered", label: "Calls Recovered" },
  { key: "leadsCreated", label: "Leads Created" },
  { key: "qualifiedLeads", label: "Qualified Leads" },
  { key: "appointmentsBooked", label: "Appointments Booked" },
  { key: "appointmentAttendance", label: "Appointment Attendance" },
  { key: "humanEscalations", label: "Human Escalations" },
  { key: "followUpAttempts", label: "Follow-Up Attempts" },
  { key: "responseTimeMedianSeconds", label: "Median Response Time" },
  { key: "estimatedOpportunityValueMinor", label: "Estimated Opportunity Value" },
];

export const CONFIGURED_METRICS = new Set(["appointmentsBooked"]);

export interface ApiMetric {
  value: number | null;
  unit: string;
}

export type MetricPresentation =
  | { key: string; label: string; state: "value"; value: number; unit: string }
  | { key: string; label: string; state: "not_configured" };

export function presentMetrics(metrics: Record<string, ApiMetric> | null): MetricPresentation[] {
  return LEAD_CAPTURE_METRICS.map((item) => {
    if (!CONFIGURED_METRICS.has(item.key)) return { ...item, state: "not_configured" };
    const metric = metrics?.[item.key];
    if (!metric || metric.value === null) return { ...item, state: "not_configured" };
    return { ...item, state: "value", value: metric.value, unit: metric.unit };
  });
}

export function metricWindow(now = new Date()): { from: string; to: string; label: string } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const from = new Date(Date.UTC(year, month, 1)).toISOString();
  const to = new Date(Date.UTC(year, month + 1, 1)).toISOString();
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month, 1)),
  );
  return { from, to, label };
}

export type ViewFailure = "unauthorized" | "unavailable" | "error";

export function classifyStatus(status: number): ViewFailure {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 0 || status === 502 || status === 503 || status === 504) return "unavailable";
  return "error";
}
