import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { calendarsFrom, eventsFrom, ghlGet } from "../../services/ghl-adapter/src/highlevel.js";
import { mapCalendarEvent } from "../../services/ghl-adapter/src/mapCalendarEvent.js";
import {
  bindingDraft,
  calendarTimezone,
  chooseCalendar,
  eventWindow,
  pullRefusal,
  redactSecrets,
} from "../../services/ghl-adapter/src/pull.js";

const fixture = JSON.parse(readFileSync(path.join(process.cwd(), "services/ghl-adapter/fixtures/calendar-event.json"), "utf8")) as Record<string, unknown>;
const dropped = ["contact_should_not_copy", "Jane Example", "jane@example.invalid", "100 Secret St", "+15555550100"];

describe("calendar event mapping", () => {
  it("keeps appointment times and drops contact fields", () => {
    const mapped = mapCalendarEvent(fixture, "loc_tenant_zero_fixture", "America/Chicago");
    expect(mapped.kind).toBe("event");
    if (mapped.kind !== "event") return;
    expect(mapped.event.attributes).toEqual({
      providerAppointmentId: "evt_calendar_fixture_001",
      startAt: "2026-10-24T15:00:00.000Z",
      endAt: "2026-10-24T15:30:00.000Z",
      timezone: "America/Chicago",
    });
    expect(mapped.event.leadId).toBeNull();
    const serialized = JSON.stringify(mapped.event);
    for (const secret of dropped) expect(serialized).not.toContain(secret);
  });

  it("uses the calendar timezone when the event has none and ignores deleted rows", () => {
    const mapped = mapCalendarEvent(
      { ...fixture, selectedTimezone: undefined },
      "loc_tenant_zero_fixture",
      "America/Chicago",
    );
    expect(mapped.kind).toBe("event");
    expect(mapCalendarEvent({ ...fixture, deleted: true }, "loc_tenant_zero_fixture", "America/Chicago").kind).toBe("ignore");
    expect(mapCalendarEvent({ ...fixture, locationId: "other" }, "loc_tenant_zero_fixture", "America/Chicago")).toMatchObject({
      kind: "invalid",
      issue: "account_mismatch",
    });
    expect(mapCalendarEvent({ ...fixture, endTime: "2026-10-24T15:00:00.000Z" }, "loc_tenant_zero_fixture", "America/Chicago")).toMatchObject({
      kind: "invalid",
      issue: "missing",
    });
  });
});

describe("private integration pull guards", () => {
  const ready = {
    FIREBASE_PROJECT_ID: "at-alamotechllc-webapp",
    GHL_LOCATION_ID: "loc_ready",
    GHL_PRIVATE_INTEGRATION_TOKEN: "pit-test-token-value",
  };

  it("refuses the emulator and a missing token without repeating the token", () => {
    expect(pullRefusal({ ...ready, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8280" })).toMatch(/FIRESTORE_EMULATOR_HOST/);
    expect(pullRefusal({ ...ready, FIREBASE_PROJECT_ID: "demo-raas-cp" })).toMatch(/at-alamotechllc-webapp/);
    const missing = pullRefusal({ ...ready, GHL_PRIVATE_INTEGRATION_TOKEN: "" });
    expect(missing).toMatch(/GHL_PRIVATE_INTEGRATION_TOKEN/);
    expect(missing).not.toContain("pit-test-token-value");
    expect(redactSecrets(`failed ${ready.GHL_PRIVATE_INTEGRATION_TOKEN}`, [ready.GHL_PRIVATE_INTEGRATION_TOKEN])).toBe("failed [redacted]");
  });

  it("selects one calendar and stores a secret name rather than the token", () => {
    expect(chooseCalendar([{ id: "cal_1", name: "Main" }], undefined)).toEqual({
      ok: true,
      calendar: { id: "cal_1", name: "Main" },
    });
    expect(chooseCalendar([{ id: "cal_1", name: "Main" }, { id: "cal_2", name: "Other" }], undefined).ok).toBe(false);
    const draft = bindingDraft({ locationId: "loc_ready", calendarId: "cal_1", projectId: "at-alamotechllc-webapp" });
    expect(draft.reconcileMode).toBe("webhook_only");
    expect(JSON.stringify(draft)).not.toContain("pit-test-token-value");
    expect("secretValue" in draft).toBe(false);
    expect(calendarTimezone({ id: "cal_1", name: "Main" })).toBe("America/Chicago");
    const window = eventWindow(new Date("2026-10-27T00:00:00.000Z"));
    expect(Number(window.endTime) - Number(window.startTime)).toBe(90 * 86_400_000);
  });

  it("does not copy a HighLevel error body or the token into the thrown error", async () => {
    const token = "pit-test-token-value";
    await expect(ghlGet({
      token,
      path: "/calendars/events",
      query: { locationId: "loc_ready" },
      fetchImpl: async () => new Response(JSON.stringify({ message: token, email: "jane@example.invalid" }), { status: 401 }),
    })).rejects.toThrow("HighLevel returned HTTP 401.");
    const listed = calendarsFrom({ calendars: [{ id: "cal_1", name: "Main", timezone: "America/Chicago" }] });
    expect(listed).toEqual([{ id: "cal_1", name: "Main", timezone: "America/Chicago" }]);
    expect(eventsFrom({ events: [{ id: "evt_1" }] })).toEqual([{ id: "evt_1" }]);
  });
});
