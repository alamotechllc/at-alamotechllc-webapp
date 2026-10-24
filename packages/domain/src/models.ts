export type TenantStatus = "pending" | "active" | "suspended" | "closed";
export type ServiceInstanceStatus = "draft" | "active" | "paused" | "ended";
export type CampaignChannel = "call" | "sms" | "email" | "form" | "calendar" | "manual" | "other";
export type CampaignStatus = "active" | "archived";
export type BindingChannel = "voice" | "sms" | "email" | "calendar" | "form" | "automation";
export type BindingStatus = "active" | "disabled";
export type ReconcileMode = "pull" | "webhook_only";
export type LeadStatus = "open" | "qualified" | "disqualified";
export type AppointmentStatus = "booked" | "attended" | "no_show" | "cancelled";
export type Attribution = "explicit" | "binding_default" | "route" | "unknown";

export interface RetentionPolicy {
  eventsMonthsAfterEnd: number;
  receiptsDays: number;
  recordingsDays: number;
}

export interface Tenant {
  tenantId: string;
  legalName: string;
  status: TenantStatus;
  createdAt: string;
  createdByUid: string;
  timezone: string;
  retention: RetentionPolicy;
}

export interface ServiceInstance {
  instanceId: string;
  tenantId: string;
  productCode: "lead-capture";
  status: ServiceInstanceStatus;
  metricPolicyVersion: string;
  metricPolicy: {
    recoveryWindowHours: number;
    businessHours: { days: number[]; start: string; end: string };
    valueBasis: "estimate";
  };
  activatedAt?: string;
  endedAt?: string;
}

export interface Campaign {
  campaignId: string;
  tenantId: string;
  serviceInstanceId: string;
  name: string;
  code: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  startAt?: string;
  endAt?: string;
}

export interface ProviderBinding {
  bindingId: string;
  tenantId: string;
  serviceInstanceId: string;
  channel: BindingChannel;
  provider: string;
  externalAccountId: string;
  secretResource: string;
  defaultCampaignId?: string;
  reconcileMode?: ReconcileMode;
  providerConfig?: { calendarId?: string };
  status: BindingStatus;
  createdAt: string;
}

export interface Lead {
  leadId: string;
  tenantId: string;
  serviceInstanceId: string;
  status: LeadStatus;
  emails: string[];
  phones: string[];
  escalationOpen: boolean;
  campaignId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  appointmentId: string;
  tenantId: string;
  serviceInstanceId: string;
  leadId?: string;
  campaignId?: string | null;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  timezone: string;
  provider: string;
  providerAppointmentId: string;
  bookedEventId: string;
  attendanceEventId?: string;
}

export interface BusinessEvent {
  schemaVersion: 1;
  eventId: string;
  eventType: string;
  occurredAt: string;
  occurredAtSource: "provider" | "adapter_received";
  recordedAt: string;
  tenantId: string;
  serviceInstanceId: string;
  campaignId: string | null;
  attribution: Attribution;
  leadId: string | null;
  correlationId: string;
  source: {
    provider: string;
    providerEventId: string;
    providerAccountId: string;
    bindingId: string;
    upstreamProvider?: string | null;
    upstreamEventId?: string | null;
  };
  attributes: Record<string, unknown>;
  canonicalHash: string;
  receiptId: string | null;
  leadCreated?: boolean;
}

export interface AuditEvent {
  auditId: string;
  tenantId: string;
  actorUid: string;
  actorRole: string;
  action:
    | "tenant.create"
    | "binding.create"
    | "binding.disable"
    | "member.grant"
    | "member.revoke"
    | "lead.merge"
    | "lead.escalation_clear"
    | "receipt.read"
    | "result.export"
    | "event.replay"
    | "retention.purge"
    | "reconciliation.resolve";
  target: { type: string; id: string };
  occurredAt: string;
  requestId: string;
}

export const DEFAULT_RETENTION: RetentionPolicy = {
  eventsMonthsAfterEnd: 24,
  receiptsDays: 90,
  recordingsDays: 30,
};

export const METRIC_POLICY_VERSION = "lead-capture-metrics-v1";

export const DEFAULT_METRIC_POLICY = {
  recoveryWindowHours: 24,
  businessHours: {
    days: [1, 2, 3, 4, 5],
    start: "09:00",
    end: "17:00",
  },
  valueBasis: "estimate" as const,
};
