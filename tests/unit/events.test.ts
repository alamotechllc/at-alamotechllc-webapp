import { describe, expect, it } from "vitest";
import {
  ApiError,
  businessEventId,
  canonicalHash,
  classifyEventType,
  validateAppointmentBookedAttributes,
  validateInboundEvent,
} from "@raas/domain";

const source = {
  provider: "gohighlevel",
  providerEventId: "appt_fixture_001",
  providerAccountId: "loc_fixture_001",
  bindingId: "bnd_test",
  upstreamProvider: null,
  upstreamEventId: null,
};

const attributes = {
  providerAppointmentId: "appt_fixture_001",
  startAt: "2026-10-24T15:00:00.000Z",
  endAt: "2026-10-24T15:30:00.000Z",
  timezone: "America/Chicago",
  locationType: "unknown" as const,
};

describe("AppointmentBooked validation", () => {
  it("accepts the milestone attribute set", () => {
    expect(validateAppointmentBookedAttributes(attributes).providerAppointmentId).toBe("appt_fixture_001");
  });

  it("rejects unknown attributes", () => {
    expect(() => validateAppointmentBookedAttributes({ ...attributes, email: "ada.fixture@example.com" })).toThrow(
      ApiError,
    );
  });

  it("rejects an end before the start", () => {
    expect(() =>
      validateAppointmentBookedAttributes({ ...attributes, endAt: "2026-10-24T14:00:00.000Z" }),
    ).toThrow(/endAt/);
  });

  it("recognizes the catalog and accepts only AppointmentBooked", () => {
    expect(classifyEventType("AppointmentBooked")).toBe("milestone");
    expect(classifyEventType("LeadCaptured")).toBe("catalog");
    expect(classifyEventType("GoHighLevelAppointmentBooked")).toBe("unknown");
    expect(() =>
      validateInboundEvent({
        eventType: "LeadCaptured",
        occurredAt: "2026-10-23T18:04:05.000Z",
        occurredAtSource: "provider",
        correlationId: "corr",
        source,
        attributes: {},
      }),
    ).toThrow(/Milestone 1/);
    expect(() =>
      validateInboundEvent({
        eventType: "GoHighLevelAppointmentBooked",
        occurredAt: "2026-10-23T18:04:05.000Z",
        occurredAtSource: "provider",
        correlationId: "corr",
        source,
        attributes,
      }),
    ).toThrow(/catalog/);
  });
});

describe("canonical hash and event id", () => {
  it("is stable for the same provider event and changes per tenant", () => {
    const first = businessEventId({
      tenantId: "ten_a",
      provider: "gohighlevel",
      providerEventId: "appt_fixture_001",
    });
    const replay = businessEventId({
      tenantId: "ten_a",
      provider: "gohighlevel",
      providerEventId: "appt_fixture_001",
    });
    const otherTenant = businessEventId({
      tenantId: "ten_b",
      provider: "gohighlevel",
      providerEventId: "appt_fixture_001",
    });
    expect(first).toBe(replay);
    expect(first).not.toBe(otherTenant);
    expect(first.startsWith("evt_")).toBe(true);
  });

  it("hashes the resolved lead and ignores key order", () => {
    const base = {
      eventType: "AppointmentBooked",
      occurredAt: "2026-10-23T18:04:05.000Z",
      tenantId: "ten_a",
      serviceInstanceId: "ins_a",
      campaignId: null,
      leadId: "led_a",
      correlationId: "appt_fixture_001",
      source,
      attributes,
    };
    const reordered = canonicalHash({
      ...base,
      attributes: {
        timezone: attributes.timezone,
        endAt: attributes.endAt,
        startAt: attributes.startAt,
        locationType: attributes.locationType,
        providerAppointmentId: attributes.providerAppointmentId,
      },
    });
    expect(canonicalHash(base)).toBe(reordered);
    expect(canonicalHash({ ...base, leadId: "led_b" })).not.toBe(canonicalHash(base));
    expect(canonicalHash({ ...base, attributes: { ...attributes, endAt: "2026-10-24T16:00:00.000Z" } })).not.toBe(
      canonicalHash(base),
    );
  });

  it("uses the upstream provider for the event id when both upstream fields are set", () => {
    const direct = businessEventId({
      tenantId: "ten_a",
      provider: "n8n",
      providerEventId: "n8n-1",
      upstreamProvider: "gohighlevel",
      upstreamEventId: "appt_fixture_001",
    });
    const vendor = businessEventId({
      tenantId: "ten_a",
      provider: "gohighlevel",
      providerEventId: "appt_fixture_001",
    });
    expect(direct).toBe(vendor);
  });
});
