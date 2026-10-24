import { describe, expect, it } from "vitest";
import { analyticsShouldCollect, screenForPath } from "../../apps/web/src/analytics-catalog.js";

const production = {
  dev: false,
  emulator: false,
  channel: "production",
  hostname: "at-alamotechllc-webapp.web.app",
  measurementId: "G-EXAMPLE123",
  appId: "1:1:web:abc",
};

describe("analytics collection gate", () => {
  it("collects only on production hosting", () => {
    expect(analyticsShouldCollect(production)).toBe(true);
  });

  it("keeps local, preview, and emulator activity out of production analytics", () => {
    expect(analyticsShouldCollect({ ...production, dev: true })).toBe(false);
    expect(analyticsShouldCollect({ ...production, emulator: true })).toBe(false);
    expect(analyticsShouldCollect({ ...production, channel: "dev" })).toBe(false);
    expect(analyticsShouldCollect({ ...production, channel: "local" })).toBe(false);
    expect(analyticsShouldCollect({ ...production, hostname: "localhost" })).toBe(false);
    expect(analyticsShouldCollect({ ...production, hostname: "at-alamotechllc-webapp--dev-72xfutnq.web.app" })).toBe(false);
    expect(analyticsShouldCollect({ ...production, measurementId: "" })).toBe(false);
  });
});

describe("analytics screens", () => {
  it("maps command-center routes and strips record ids", () => {
    expect(screenForPath("/sign-in")?.event).toBe("login_viewed");
    expect(screenForPath("/")?.title).toBe("RaaS Overview");
    expect(screenForPath("/raas")?.pagePath).toBe("/");
    expect(screenForPath("/clients")?.event).toBe("clients_viewed");
    expect(screenForPath("/clients/ten_01ARZ3NDEKTSV4RRFFQ69G5FAV")).toEqual({
      pagePath: "/clients/detail",
      title: "Client",
      event: "clients_viewed",
    });
    expect(screenForPath("/campaigns")?.event).toBe("campaigns_viewed");
    expect(screenForPath("/raas/clients/ten_01ARZ3NDEKTSV4RRFFQ69G5FAV")?.pagePath).toBe("/clients/detail");
    expect(screenForPath("/appointments")?.event).toBe("appointments_viewed");
    expect(screenForPath("/results")?.event).toBe("results_viewed");
    expect(screenForPath("/operations")?.event).toBe("operations_viewed");
    expect(screenForPath("/unknown")).toBeNull();
  });
});
