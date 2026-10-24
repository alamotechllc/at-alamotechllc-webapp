import { describe, expect, it } from "vitest";
import { componentScore, scoreResult, statusForScore } from "../../packages/domain/src/scoring.js";

describe("result score status", () => {
  it("uses the published boundaries", () => {
    expect(statusForScore(100)).toBe("Excellent");
    expect(statusForScore(90)).toBe("Excellent");
    expect(statusForScore(89)).toBe("Good");
    expect(statusForScore(75)).toBe("Good");
    expect(statusForScore(74)).toBe("Watch");
    expect(statusForScore(60)).toBe("Watch");
    expect(statusForScore(59)).toBe("At Risk");
    expect(statusForScore(40)).toBe("At Risk");
    expect(statusForScore(39)).toBe("Critical");
    expect(statusForScore(0)).toBe("Critical");
  });

  it("scores a higher-is-better ratio and a lower-is-better ratio", () => {
    expect(componentScore(80, 100, "higher")).toBe(80);
    expect(componentScore(150, 100, "higher")).toBe(100);
    expect(componentScore(50, 100, "lower")).toBe(100);
    expect(componentScore(200, 100, "lower")).toBe(50);
  });

  it("hides the overall score unless every weighted part is measured", () => {
    const scored = scoreResult({
      id: "sample",
      type: "sample",
      customerId: "ten_sample",
      calculatedAt: "2026-10-24T00:00:00.000Z",
      components: [
        part("a", 60, 80, 70),
        part("b", 40, 50, 50),
      ],
    });
    expect(scored.components.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
    expect(scored.overallScore).toBe(68);
    expect(scored.status).toBe("Watch");
    expect(scored.previousScore).toBe(62);
    expect(scored.scoreChange).toBe(6);
    expect(scored.components[0].trend).toBe("up");

    const partial = scoreResult({
      id: "sample",
      type: "sample",
      customerId: "ten_sample",
      calculatedAt: "2026-10-24T00:00:00.000Z",
      components: [
        part("a", 60, 100, 100),
        { ...part("b", 40, null, null), insufficientReason: "Missing.", rawValue: null, target: null },
      ],
    });
    expect(partial.overallScore).toBeNull();
    expect(partial.status).toBe("Insufficient data");
    expect(partial.scoreChange).toBeNull();
  });

  it("refuses a model whose weights do not total 100", () => {
    const result = scoreResult({
      id: "sample",
      type: "sample",
      customerId: "ten_sample",
      calculatedAt: "2026-10-24T00:00:00.000Z",
      components: [part("a", 40, 100, 100)],
    });
    expect(result.overallScore).toBeNull();
    expect(result.explanation).toMatch(/100/);
  });
});

function part(id: string, weight: number, raw: number | null, previous: number | null) {
  return {
    id,
    name: id,
    weight,
    direction: "higher" as const,
    unit: "percent",
    rawValue: raw,
    target: raw === null ? null : 100,
    previousRawValue: previous,
    explanation: `${id} explanation`,
    insufficientReason: null,
  };
}
