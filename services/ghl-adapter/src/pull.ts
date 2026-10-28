import { TENANT_ZERO, type BindingChannel } from "@raas/domain";

export const CLOUD_PROJECT_ID = "at-alamotechllc-webapp";
const PULL_DAYS = 90;

export interface PullEnv {
  FIRESTORE_EMULATOR_HOST?: string;
  FIREBASE_PROJECT_ID?: string;
  GHL_LOCATION_ID?: string;
  GHL_PRIVATE_INTEGRATION_TOKEN?: string;
  GHL_CALENDAR_ID?: string;
}

export interface NamedCalendar {
  id: string;
  name: string;
  timezone?: string;
}

export function pullRefusal(env: PullEnv): string | null {
  if (env.FIRESTORE_EMULATOR_HOST) return "Refusing to pull while FIRESTORE_EMULATOR_HOST is set.";
  if (env.FIREBASE_PROJECT_ID !== CLOUD_PROJECT_ID) return "Refusing to pull unless FIREBASE_PROJECT_ID is at-alamotechllc-webapp.";
  if (!env.GHL_LOCATION_ID?.trim()) return "GHL_LOCATION_ID is missing.";
  if (!env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim()) return "GHL_PRIVATE_INTEGRATION_TOKEN is missing.";
  return null;
}

export function redactSecrets(text: string, secrets: string[]): string {
  let redacted = text;
  for (const secret of secrets) {
    if (secret.length < 8) continue;
    redacted = redacted.split(secret).join("[redacted]");
  }
  return redacted;
}

export function eventWindow(now: Date, days = PULL_DAYS): { startTime: string; endTime: string } {
  const end = now.getTime();
  return {
    startTime: String(end - days * 86_400_000),
    endTime: String(end),
  };
}

export function chooseCalendar(
  calendars: NamedCalendar[],
  preferred: string | undefined,
): { ok: true; calendar: NamedCalendar } | { ok: false; reason: "none" | "many" | "missing"; calendars: NamedCalendar[] } {
  const wanted = preferred?.trim();
  if (wanted) {
    const match = calendars.find((item) => item.id === wanted);
    return match ? { ok: true, calendar: match } : { ok: false, reason: "missing", calendars };
  }
  if (calendars.length === 1) return { ok: true, calendar: calendars[0] };
  if (calendars.length === 0) return { ok: false, reason: "none", calendars };
  return { ok: false, reason: "many", calendars };
}

export function calendarTimezone(calendar: NamedCalendar): string {
  if (!calendar.timezone) return TENANT_ZERO.timezone;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: calendar.timezone });
    return calendar.timezone;
  } catch {
    return TENANT_ZERO.timezone;
  }
}

export function bindingDraft(input: { locationId: string; calendarId: string; projectId: string }): {
  tenantId: string;
  serviceInstanceId: string;
  channel: BindingChannel;
  provider: "gohighlevel";
  externalAccountId: string;
  secretResource: string;
  reconcileMode: "webhook_only";
  providerConfig: { calendarId: string };
  actorUid: string;
  actorRole: string;
  requestId: string;
} {
  return {
    tenantId: TENANT_ZERO.tenantId,
    serviceInstanceId: TENANT_ZERO.instanceId,
    channel: "calendar",
    provider: "gohighlevel",
    externalAccountId: input.locationId,
    secretResource: `projects/${input.projectId}/secrets/ghl-private-integration/versions/unstored`,
    reconcileMode: "webhook_only",
    providerConfig: { calendarId: input.calendarId },
    actorUid: "pull-ghl",
    actorRole: "platform_admin",
    requestId: "pull-ghl-appointments",
  };
}
