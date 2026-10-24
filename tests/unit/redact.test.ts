import { describe, expect, it } from "vitest";
import { JsonLogger } from "@raas/logging";

describe("logging redaction", () => {
  it("drops secrets and contact fields before the log line is written", () => {
    const lines: string[] = [];
    const logger = new JsonLogger((line) => lines.push(line));
    logger.write({
      severity: "INFO",
      message: "event ingested",
      eventId: "evt_fixture",
      authorization: "Bearer secret-token",
      email: "ada.fixture@example.com",
      secretValue: "binding-secret",
      attributes: { phone: "+15555550100", providerAppointmentId: "appt_fixture_001" },
    });
    const line = lines[0] ?? "";
    expect(line).toContain("evt_fixture");
    expect(line).toContain("appt_fixture_001");
    expect(line).not.toContain("secret-token");
    expect(line).not.toContain("ada.fixture@example.com");
    expect(line).not.toContain("binding-secret");
    expect(line).not.toContain("+15555550100");
    expect(line).toContain("[redacted]");
  });
});
