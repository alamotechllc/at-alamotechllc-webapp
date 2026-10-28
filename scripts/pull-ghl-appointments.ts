import { readFileSync } from "node:fs";
import { ApiError } from "@raas/domain";
import { createProviderBinding, firestore, ingestEvent, resolveProviderBinding } from "@raas/store";
import { calendarsFrom, eventsFrom, ghlGet } from "../services/ghl-adapter/src/highlevel.js";
import { mapCalendarEvent } from "../services/ghl-adapter/src/mapCalendarEvent.js";
import {
  bindingDraft,
  calendarTimezone,
  chooseCalendar,
  CLOUD_PROJECT_ID,
  eventWindow,
  pullRefusal,
  redactSecrets,
  type NamedCalendar,
} from "../services/ghl-adapter/src/pull.js";

loadEnvFile();

const refusal = pullRefusal(process.env);
if (refusal) stop(refusal);

const token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim() ?? "";
const locationId = process.env.GHL_LOCATION_ID?.trim() ?? "";

try {
  await pullAppointments();
} catch (error) {
  const message = error instanceof Error ? error.message : "Pull failed.";
  stop(redactSecrets(message, [token, locationId]));
}

async function pullAppointments(): Promise<void> {
  const calendars = calendarsFrom(await ghlGet({
    fetchImpl: fetch,
    token,
    path: "/calendars/",
    query: { locationId },
  }));
  const chosen = chooseCalendar(calendars, process.env.GHL_CALENDAR_ID);
  if (!chosen.ok) {
    if (chosen.reason === "many") {
      console.error("PULL STOPPED");
      console.error("More than one calendar. Set GHL_CALENDAR_ID.");
      for (const calendar of chosen.calendars) console.error(`${calendar.name} ${calendar.id}`);
      process.exit(1);
    }
    if (chosen.reason === "missing") stop("GHL_CALENDAR_ID was not in the calendar list.");
    stop("No calendars were returned for this location.");
  }

  const window = eventWindow(new Date());
  const events = eventsFrom(await ghlGet({
    fetchImpl: fetch,
    token,
    path: "/calendars/events",
    query: {
      locationId,
      calendarId: chosen.calendar.id,
      startTime: window.startTime,
      endTime: window.endTime,
    },
  }));
  const db = firestore();
  await ensureBinding(chosen.calendar);
  const counts = { calendars: 1, seen: events.length, created: 0, replayed: 0, skipped: 0 };
  const timezone = calendarTimezone(chosen.calendar);
  for (const row of events) {
    const mapped = mapCalendarEvent(row, locationId, timezone);
    if (mapped.kind !== "event") {
      counts.skipped += 1;
      continue;
    }
    try {
      const result = await ingestEvent(db, {
        eventType: mapped.event.eventType,
        occurredAt: mapped.event.occurredAt,
        occurredAtSource: mapped.event.occurredAtSource,
        correlationId: mapped.event.correlationId,
        campaignId: null,
        leadId: null,
        tenantId: bindingDraft({ locationId, calendarId: chosen.calendar.id, projectId: CLOUD_PROJECT_ID }).tenantId,
        source: mapped.event.source,
        attributes: { ...mapped.event.attributes },
      });
      if (result.replayed) counts.replayed += 1;
      else counts.created += 1;
    } catch (error) {
      if (error instanceof ApiError && error.code === "IDEMPOTENCY_CONFLICT") {
        console.log(JSON.stringify({ ...counts, stopped: "idempotency_conflict" }));
        process.exit(1);
      }
      throw error;
    }
  }
  console.log(JSON.stringify(counts));
}

async function ensureBinding(calendar: NamedCalendar): Promise<void> {
  const db = firestore();
  try {
    await resolveProviderBinding(db, "gohighlevel", locationId);
    return;
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== "BINDING_UNKNOWN") throw error;
  }
  const draft = bindingDraft({ locationId, calendarId: calendar.id, projectId: CLOUD_PROJECT_ID });
  await createProviderBinding(db, draft);
}

function loadEnvFile(): void {
  let text = "";
  try {
    text = readFileSync(new URL("../.env", import.meta.url), "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const splitAt = trimmed.indexOf("=");
    const key = trimmed.slice(0, splitAt).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(splitAt + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function stop(message: string): never {
  console.error("PULL STOPPED");
  console.error(message);
  process.exit(1);
}
