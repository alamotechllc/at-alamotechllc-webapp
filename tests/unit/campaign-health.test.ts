import { describe, expect, it } from "vitest";
import { campaignHealth } from "../../apps/web/src/campaign-health.js";

const bounds = { from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" };

describe("campaign health", () => {
  it("marks an active campaign working only when this period has a booking", () => {
    const health = campaignHealth(
      [
        { campaignId: "cmp_quiet", name: "Quiet", channel: "form", status: "active" },
        { campaignId: "cmp_live", name: "Live", channel: "calendar", status: "active" },
        { campaignId: "cmp_old", name: "Old", channel: "call", status: "archived" },
      ],
      [
        { campaignId: "cmp_live", startAt: "2026-10-04T15:00:00.000Z" },
        { campaignId: "cmp_live", startAt: "2026-10-20T15:00:00.000Z" },
        { campaignId: "cmp_live", startAt: "2026-09-01T15:00:00.000Z" },
        { campaignId: "cmp_old", startAt: "2026-10-02T15:00:00.000Z" },
        { campaignId: null, startAt: "2026-10-11T15:00:00.000Z" },
        { campaignId: "", startAt: "2026-10-12T15:00:00.000Z" },
      ],
      bounds,
    );
    expect(health.campaigns.map((item) => [item.name, item.verdict, item.bookings, item.latestBookingAt])).toEqual([
      ["Live", "Working", 2, "2026-10-20T15:00:00.000Z"],
      ["Old", "Archived", 1, "2026-10-02T15:00:00.000Z"],
      ["Quiet", "No bookings this period", 0, null],
    ]);
    expect(health.unattributedBookings).toBe(2);
    expect(health.unattributedLatestBookingAt).toBe("2026-10-12T15:00:00.000Z");
  });
});
