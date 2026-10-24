import { describe, expect, it } from "vitest";
import { DEFAULT_METRIC_POLICY, computeLeadCaptureResults, type ResultEvent } from "@raas/domain";

const window = {
  periodStart: "2026-10-01T00:00:00.000Z",
  periodEnd: "2026-11-01T00:00:00.000Z",
  timezone: "America/Chicago",
};

function booked(occurredAt: string): ResultEvent {
  return {
    eventType: "AppointmentBooked",
    occurredAt,
    recordedAt: occurredAt,
    leadId: "led_fixture",
    correlationId: occurredAt,
    attribution: "unknown",
    attributes: {},
  };
}

describe("appointmentsBooked", () => {
  it("counts AppointmentBooked events inside the half-open window", () => {
    const metrics = computeLeadCaptureResults(
      [
        booked("2026-09-30T23:59:59.000Z"),
        booked("2026-10-01T00:00:00.000Z"),
        booked("2026-10-23T18:04:05.000Z"),
        booked("2026-11-01T00:00:00.000Z"),
      ],
      DEFAULT_METRIC_POLICY,
      window,
    );
    expect(metrics.appointmentsBooked.value).toBe(2);
    expect(metrics.appointmentsBooked.unit).toBe("count");
  });

  it("does not read Firestore", () => {
    const source = computeLeadCaptureResults.toString();
    expect(source).not.toContain("firestore");
    expect(source).not.toContain("firebase");
  });
});
