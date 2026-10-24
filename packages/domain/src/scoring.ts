export type ScoreStatus = "Excellent" | "Good" | "Watch" | "At Risk" | "Critical";
export type ScoreTrend = "up" | "down" | "flat" | "unknown";

export interface ScoreComponentInput {
  id: string;
  name: string;
  weight: number;
  direction: "higher" | "lower";
  unit: string;
  rawValue: number | null;
  target: number | null;
  previousRawValue: number | null;
  explanation: string;
  insufficientReason: string | null;
}

export interface ScoreComponent {
  id: string;
  name: string;
  weight: number;
  rawValue: number | null;
  target: number | null;
  score: number | null;
  previousScore: number | null;
  trend: ScoreTrend;
  unit: string;
  explanation: string;
  insufficientReason: string | null;
}

export interface ScoredResult {
  id: string;
  type: string;
  customerId: string;
  overallScore: number | null;
  status: ScoreStatus | "Insufficient data";
  previousScore: number | null;
  scoreChange: number | null;
  calculatedAt: string;
  components: ScoreComponent[];
  explanation: string;
}

export function statusForScore(score: number): ScoreStatus {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Watch";
  if (score >= 40) return "At Risk";
  return "Critical";
}

export function componentScore(raw: number, target: number, direction: "higher" | "lower"): number {
  if (direction === "higher") {
    if (target <= 0) return 0;
    return clamp(Math.round((raw / target) * 100));
  }
  if (raw <= target) return 100;
  if (raw <= 0) return 100;
  return clamp(Math.round((target / raw) * 100));
}

export function scoreResult(input: {
  id: string;
  type: string;
  customerId: string;
  calculatedAt: string;
  components: ScoreComponentInput[];
}): ScoredResult {
  const weightTotal = input.components.reduce((sum, item) => sum + item.weight, 0);
  const components = input.components.map(scoreComponent);
  if (weightTotal !== 100) {
    return {
      id: input.id,
      type: input.type,
      customerId: input.customerId,
      overallScore: null,
      status: "Insufficient data",
      previousScore: null,
      scoreChange: null,
      calculatedAt: input.calculatedAt,
      components,
      explanation: "Component weights must total 100 before a result score is shown.",
    };
  }
  const current = weighted(components.map((item) => item.score), components);
  const previous = weighted(components.map((item) => item.previousScore), components);
  const missing = components.filter((item) => item.score === null);
  return {
    id: input.id,
    type: input.type,
    customerId: input.customerId,
    overallScore: current,
    status: current === null ? "Insufficient data" : statusForScore(current),
    previousScore: previous,
    scoreChange: current === null || previous === null ? null : current - previous,
    calculatedAt: input.calculatedAt,
    components,
    explanation: current === null
      ? `${missing.length} of ${components.length} score parts are not measured, so the result score is hidden.`
      : `Result score ${current} is the weight of each part.`,
  };
}

function scoreComponent(input: ScoreComponentInput): ScoreComponent {
  const scored = input.insufficientReason === null && input.rawValue !== null && input.target !== null;
  const score = scored ? componentScore(input.rawValue!, input.target!, input.direction) : null;
  const previousScored = input.insufficientReason === null && input.previousRawValue !== null && input.target !== null;
  const previousScore = previousScored ? componentScore(input.previousRawValue!, input.target!, input.direction) : null;
  return {
    id: input.id,
    name: input.name,
    weight: input.weight,
    rawValue: input.insufficientReason ? null : input.rawValue,
    target: input.insufficientReason ? null : input.target,
    score,
    previousScore,
    trend: trendBetween(score, previousScore),
    unit: input.unit,
    explanation: input.explanation,
    insufficientReason: input.insufficientReason,
  };
}

function weighted(scores: Array<number | null>, components: ScoreComponent[]): number | null {
  let total = 0;
  for (let index = 0; index < scores.length; index += 1) {
    const score = scores[index];
    if (score === null || score === undefined) return null;
    total += score * components[index].weight;
  }
  return Math.round(total / 100);
}

function trendBetween(current: number | null, previous: number | null): ScoreTrend {
  if (current === null || previous === null) return "unknown";
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}
