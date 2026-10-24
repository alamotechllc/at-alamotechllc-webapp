import { describe, expect, it } from "vitest";
import { classifyStatus, presentMetrics } from "../../apps/web/src/metrics.js";

describe("results presentation", () => {
  it("keeps a measured zero and does not invent unconfigured metrics", () => {
    const slots = presentMetrics({
      appointmentsBooked: { value: 0, unit: "count" },
      callsReceived: { value: 0, unit: "count" },
    });
    const booked = slots.find((item) => item.key === "appointmentsBooked");
    const calls = slots.find((item) => item.key === "callsReceived");
    expect(booked).toEqual({ key: "appointmentsBooked", label: "Appointments Booked", state: "value", value: 0, unit: "count" });
    expect(calls).toEqual({ key: "callsReceived", label: "Calls Received", state: "not_configured" });
  });

  it("does not turn an API failure into a zero", () => {
    expect(classifyStatus(503)).toBe("unavailable");
    expect(classifyStatus(401)).toBe("unauthorized");
    expect(classifyStatus(500)).toBe("error");
    expect(classifyStatus(500)).not.toBe("value");
  });
});
