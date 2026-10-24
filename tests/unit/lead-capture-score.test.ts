import { describe, expect, it } from "vitest";
import { leadCapturePicture } from "../../apps/web/src/lead-capture-score.js";

const now = new Date("2026-10-24T12:00:00.000Z");

describe("lead capture score", () => {
  it("keeps the result score hidden and still reports real counts", () => {
    const picture = leadCapturePicture({
      customerId: "ten_sample",
      instanceId: "ins_sample",
      now,
      days: 30,
      leads: [
        lead("led_1", "2026-10-20T00:00:00.000Z", "qualified", true),
        lead("led_2", "2026-10-21T00:00:00.000Z", "open", false),
        lead("led_old", "2026-09-01T00:00:00.000Z", "open", true),
      ],
      appointments: [
        appointment("2026-10-22T00:00:00.000Z", null),
        appointment("2026-09-02T00:00:00.000Z", "led_old"),
      ],
    });
    expect(picture.result.components.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
    expect(picture.result.overallScore).toBeNull();
    expect(picture.result.status).toBe("Insufficient data");
    expect(picture.result.components.find((item) => item.id === "data_quality")?.score).toBe(50);
    expect(picture.result.components.find((item) => item.id === "response_performance")?.score).toBeNull();
    expect(picture.kpis.map((item) => [item.id, item.value, item.previous])).toEqual([
      ["appointments_booked", 1, 1],
      ["leads_captured", 2, 1],
    ]);
    expect(picture.funnel?.map((item) => [item.id, item.count])).toEqual([
      ["leads", 2],
      ["qualified", 1],
    ]);
    expect(picture.recommendations.some((item) => item.id === "add-contact-details")).toBe(true);
    expect(picture.days).toHaveLength(30);
    expect(picture.insights.some((item) => item.summary.includes("Leads captured increased"))).toBe(true);
  });

  it("does not draw a funnel or a data-quality score when the period has no leads", () => {
    const picture = leadCapturePicture({
      customerId: "ten_sample",
      instanceId: "ins_sample",
      now,
      days: 30,
      leads: [],
      appointments: [],
    });
    expect(picture.result.components.every((item) => item.score === null)).toBe(true);
    expect(picture.funnel).toBeNull();
    expect(picture.kpis.every((item) => item.value === 0 && item.trend === "flat")).toBe(true);
    expect(picture.recommendations.map((item) => item.id)).toEqual(["measure-missing-parts"]);
  });

  it("recommends a booking review when appointments fall by more than 10 percent", () => {
    const picture = leadCapturePicture({
      customerId: "ten_sample",
      instanceId: "ins_sample",
      now,
      days: 30,
      leads: [],
      appointments: [
        appointment("2026-10-10T00:00:00.000Z", null),
        appointment("2026-09-20T00:00:00.000Z", null),
        appointment("2026-09-21T00:00:00.000Z", null),
        appointment("2026-09-22T00:00:00.000Z", null),
      ],
    });
    expect(picture.recommendations.some((item) => item.id === "review-bookings")).toBe(true);
  });
});

function lead(leadId: string, createdAt: string, status: string, hasContact: boolean) {
  return { leadId, createdAt, status, hasContact, serviceInstanceId: "ins_sample" };
}

function appointment(startAt: string, leadId: string | null) {
  return { startAt, leadId, serviceInstanceId: "ins_sample" };
}
