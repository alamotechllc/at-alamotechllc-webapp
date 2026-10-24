import { describe, expect, it } from "vitest";
import { noticeCopy, sharedFailure, unavailableLabel } from "../../apps/web/src/view-state.js";

describe("shared API failures", () => {
  it("collapses identical failures and keeps a single request visible", () => {
    const same = { status: "failed" as const, failure: "unavailable", message: "The API is unavailable." };
    expect(sharedFailure([same, same, same])?.failure).toBe("unavailable");
    expect(sharedFailure([same])).toBeNull();
    expect(sharedFailure([same, { status: "loading" }])).toBeNull();
    expect(sharedFailure([
      same,
      { status: "failed", failure: "error", message: "The request failed." },
    ])).toBeNull();
  });

  it("does not describe a failed read as zero", () => {
    expect(unavailableLabel("unavailable")).toBe("Unavailable");
    expect(unavailableLabel("error")).toBe("Unavailable");
    expect(unavailableLabel("unauthorized")).toBe("Unauthorized");
    expect(noticeCopy("unavailable", "Unexpected error.").title).toBe("RaaS API unavailable");
    expect(noticeCopy("error", "Unexpected error.").detail).toBe("We couldn't retrieve current Lead Capture results.");
    expect(noticeCopy("error", "The request failed.").title).toBe("RaaS API unavailable");
    expect(noticeCopy("error", "Campaign is unknown.").detail).toBe("Campaign is unknown.");
  });
});
