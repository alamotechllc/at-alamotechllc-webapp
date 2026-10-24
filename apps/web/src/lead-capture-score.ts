import {
  scoreResult,
  type ScoreComponentInput,
  type ScoredResult,
  type ScoreTrend,
} from "../../../packages/domain/src/scoring.js";

export interface LeadFact {
  leadId: string;
  createdAt: string;
  status: string;
  hasContact: boolean;
  serviceInstanceId: string;
}

export interface AppointmentFact {
  startAt: string;
  leadId: string | null;
  serviceInstanceId: string;
}

export interface CountKpi {
  id: string;
  label: string;
  value: number;
  previous: number;
  change: number;
  changePercent: number | null;
  trend: ScoreTrend;
  href: string | null;
}

export interface DailyCount {
  date: string;
  leads: number;
  appointments: number;
}

export interface FunnelStage {
  id: string;
  label: string;
  count: number;
  fromPrevious: number | null;
}

export interface Insight {
  id: string;
  summary: string;
  detail: string;
}

export interface Recommendation {
  id: string;
  title: string;
  why: string;
}

export interface LeadCapturePicture {
  result: ScoredResult;
  kpis: CountKpi[];
  days: DailyCount[];
  funnel: FunnelStage[] | null;
  insights: Insight[];
  recommendations: Recommendation[];
}

const CAPTURE_MISSING = "No capture target is defined. Lead and appointment counts stay as counts and are not turned into this score.";
const RESPONSE_MISSING = "Median response time comes from inbound and outbound events. Those events are not available on this screen.";
const CONVERSION_MISSING = "No conversion target is defined, and appointments without a lead id are not counted as conversions.";
const AUTOMATION_MISSING = "Automation success and failure results are not available on this screen.";

export function leadCapturePicture(input: {
  customerId: string;
  instanceId: string;
  now: Date;
  days: number;
  leads: LeadFact[];
  appointments: AppointmentFact[];
}): LeadCapturePicture {
  const bounds = rollingBounds(input.days, input.now);
  const leads = input.leads.filter((item) => sameInstance(item.serviceInstanceId, input.instanceId));
  const appointments = input.appointments.filter((item) => sameInstance(item.serviceInstanceId, input.instanceId));
  const currentLeads = leads.filter((item) => inRange(item.createdAt, bounds.from, bounds.to));
  const previousLeads = leads.filter((item) => inRange(item.createdAt, bounds.previousFrom, bounds.previousTo));
  const currentAppointments = appointments.filter((item) => inRange(item.startAt, bounds.from, bounds.to));
  const previousAppointments = appointments.filter((item) => inRange(item.startAt, bounds.previousFrom, bounds.previousTo));
  const quality = contactQuality(currentLeads);
  const previousQuality = contactQuality(previousLeads);
  const components: ScoreComponentInput[] = [
    missingPart("capture_health", "Capture Health", 30, CAPTURE_MISSING),
    missingPart("response_performance", "Response Performance", 25, RESPONSE_MISSING),
    missingPart("conversion_performance", "Conversion Performance", 20, CONVERSION_MISSING),
    missingPart("automation_health", "Automation Health", 15, AUTOMATION_MISSING),
    quality.part,
  ];
  if (previousQuality.raw !== null) {
    const dataQuality = components[4];
    dataQuality.previousRawValue = previousQuality.raw;
  }
  const result = scoreResult({
    id: "lead-capture",
    type: "lead-capture",
    customerId: input.customerId,
    calculatedAt: input.now.toISOString(),
    components,
  });
  const kpis = [
    countKpi("appointments_booked", "Appointments booked", currentAppointments.length, previousAppointments.length, "/appointments"),
    countKpi("leads_captured", "Leads captured", currentLeads.length, previousLeads.length, null),
  ];
  return {
    result,
    kpis,
    days: dailyCounts(currentLeads, currentAppointments, input.days, input.now),
    funnel: funnelFor(currentLeads, currentAppointments),
    insights: insightsFor(result, kpis, quality),
    recommendations: recommendationsFor(result, kpis, quality),
  };
}

function missingPart(id: string, name: string, weight: number, reason: string): ScoreComponentInput {
  return {
    id,
    name,
    weight,
    direction: "higher",
    unit: "percent",
    rawValue: null,
    target: null,
    previousRawValue: null,
    explanation: reason,
    insufficientReason: reason,
  };
}

function contactQuality(leads: LeadFact[]): { raw: number | null; withContact: number; total: number; part: ScoreComponentInput } {
  if (leads.length === 0) {
    const reason = "No leads were recorded in this period, so contact details cannot be scored.";
    return {
      raw: null,
      withContact: 0,
      total: 0,
      part: {
        id: "data_quality",
        name: "Data Quality",
        weight: 10,
        direction: "higher",
        unit: "percent",
        rawValue: null,
        target: null,
        previousRawValue: null,
        explanation: reason,
        insufficientReason: reason,
      },
    };
  }
  const withContact = leads.filter((item) => item.hasContact).length;
  const raw = Math.round((withContact / leads.length) * 100);
  return {
    raw,
    withContact,
    total: leads.length,
    part: {
      id: "data_quality",
      name: "Data Quality",
      weight: 10,
      direction: "higher",
      unit: "percent",
      rawValue: raw,
      target: 100,
      previousRawValue: null,
      explanation: `${withContact} of ${leads.length} leads in this period have an email or phone. The target is every lead.`,
      insufficientReason: null,
    },
  };
}

function funnelFor(leads: LeadFact[], appointments: AppointmentFact[]): FunnelStage[] | null {
  if (leads.length === 0) return null;
  const qualified = leads.filter((item) => item.status === "qualified").length;
  const leadIds = new Set(leads.map((item) => item.leadId));
  const convertedIds = new Set(
    appointments
      .map((item) => item.leadId)
      .filter((id): id is string => id !== null && leadIds.has(id)),
  );
  const stages: FunnelStage[] = [
    { id: "leads", label: "Leads", count: leads.length, fromPrevious: null },
    { id: "qualified", label: "Qualified", count: qualified, fromPrevious: percent(qualified, leads.length) },
  ];
  if (convertedIds.size > 0) {
      stages.push({
        id: "converted",
        label: "Booked",
        count: convertedIds.size,
        fromPrevious: qualified === 0 ? 0 : percent(convertedIds.size, qualified),
      });
  }
  return stages;
}

function insightsFor(
  result: ScoredResult,
  kpis: CountKpi[],
  quality: { withContact: number; total: number; raw: number | null },
): Insight[] {
  const insights: Insight[] = [];
  const missing = result.components.filter((item) => item.score === null);
  if (missing.length > 0) {
    insights.push({
      id: "score-hidden",
      summary: result.explanation,
      detail: missing.map((item) => `${item.name}: ${item.insufficientReason}`).join(" "),
    });
  }
  for (const kpi of kpis) {
    if (kpi.change === 0) continue;
    const direction = kpi.change > 0 ? "increased" : "decreased";
    insights.push({
      id: `${kpi.id}-change`,
      summary: `${kpi.label} ${direction} from ${kpi.previous} to ${kpi.value}.`,
      detail: "This compares the selected period with the period of the same length immediately before it.",
    });
  }
  const dataQuality = result.components.find((item) => item.id === "data_quality");
  if (
    quality.raw !== null
    && dataQuality
    && dataQuality.previousScore !== null
    && dataQuality.score !== null
    && dataQuality.score !== dataQuality.previousScore
  ) {
    const direction = dataQuality.score > dataQuality.previousScore ? "increased" : "decreased";
    insights.push({
      id: "data-quality-change",
      summary: `Data Quality ${direction} from ${dataQuality.previousScore} to ${dataQuality.score}.`,
      detail: quality.total === 0
        ? "No leads were recorded in this period."
        : `${quality.withContact} of ${quality.total} leads in this period have an email or phone.`,
    });
  }
  return insights;
}

function recommendationsFor(
  result: ScoredResult,
  kpis: CountKpi[],
  quality: { withContact: number; total: number },
): Recommendation[] {
  const items: Recommendation[] = [];
  const missing = result.components.filter((item) => item.score === null);
  if (missing.length > 0) {
    items.push({
      id: "measure-missing-parts",
      title: `Measure ${missing.map((item) => item.name).join(", ")} before trusting a result score.`,
      why: missing.map((item) => item.insufficientReason).join(" "),
    });
  }
  const booked = kpis.find((item) => item.id === "appointments_booked");
  if (booked && booked.previous > 0 && booked.value < booked.previous * 0.9) {
    items.push({
      id: "review-bookings",
      title: "Review the booking source.",
      why: `Appointments booked fell from ${booked.previous} to ${booked.value}, more than 10 percent.`,
    });
  }
  const dataQuality = result.components.find((item) => item.id === "data_quality");
  if (dataQuality && dataQuality.score !== null && dataQuality.score < 75) {
    items.push({
      id: "add-contact-details",
      title: "Add a phone or email on leads that have neither.",
      why: `${quality.withContact} of ${quality.total} leads in this period have an email or phone. Data Quality is ${dataQuality.score}, below 75.`,
    });
  }
  return items;
}

function countKpi(id: string, label: string, value: number, previous: number, href: string | null): CountKpi {
  const change = value - previous;
  return {
    id,
    label,
    value,
    previous,
    change,
    changePercent: previous === 0 ? null : Math.round((change / previous) * 100),
    trend: change > 0 ? "up" : change < 0 ? "down" : "flat",
    href,
  };
}

export function rollingBounds(days: number, now: Date): { from: string; to: string; previousFrom: string; previousTo: string } {
  const to = now.getTime();
  const span = days * 86_400_000;
  const from = to - span;
  return {
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    previousFrom: new Date(from - span).toISOString(),
    previousTo: new Date(from).toISOString(),
  };
}

function dailyCounts(leads: LeadFact[], appointments: AppointmentFact[], days: number, now: Date): DailyCount[] {
  const end = Date.parse(now.toISOString().slice(0, 10) + "T00:00:00.000Z");
  const rows: DailyCount[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(end - offset * 86_400_000).toISOString().slice(0, 10);
    rows.push({
      date: day,
      leads: leads.filter((item) => item.createdAt.slice(0, 10) === day).length,
      appointments: appointments.filter((item) => item.startAt.slice(0, 10) === day).length,
    });
  }
  return rows;
}

function sameInstance(recordInstance: string, expected: string): boolean {
  if (!expected || !recordInstance) return true;
  return recordInstance === expected;
}

function inRange(value: string, from: string, to: string): boolean {
  const at = Date.parse(value);
  return Number.isFinite(at) && at >= Date.parse(from) && at < Date.parse(to);
}

function percent(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}
