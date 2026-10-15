import { severityFor } from "./severity";
import type { AssessmentPoint, MetricSettings, Scale, ScaleSummary, ScaleTrend, Trend } from "./types";

/** Chronological order: by assessment date, then by creation time (tie-breaker for same-day imports). */
export function sortChronologically(points: AssessmentPoint[]): AssessmentPoint[] {
  return [...points].sort((a, b) => {
    if (a.assessedAt !== b.assessedAt) return a.assessedAt < b.assessedAt ? -1 : 1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return 0;
  });
}

export function pickBaselineAndLatest(points: AssessmentPoint[]): {
  baseline: AssessmentPoint | null;
  latest: AssessmentPoint | null;
} {
  if (points.length === 0) return { baseline: null, latest: null };
  const sorted = sortChronologically(points);
  return { baseline: sorted[0], latest: sorted[sorted.length - 1] };
}

/** Negative delta = improvement. Changes smaller than the threshold are "stable". */
export function scaleTrend(delta: number | null, threshold: number): ScaleTrend | null {
  if (delta === null) return null;
  if (delta <= -threshold) return "improving";
  if (delta >= threshold) return "worsening";
  return "stable";
}

export function combinedTrend(
  phq: ScaleTrend | null,
  gad: ScaleTrend | null,
  hasAnyScore: boolean,
): Trend | null {
  const trends = [phq, gad].filter((t): t is ScaleTrend => t !== null);
  if (trends.length === 0) return hasAnyScore ? "first_score" : null;
  const hasWorsening = trends.includes("worsening");
  const hasImproving = trends.includes("improving");
  if (hasWorsening && hasImproving) return "mixed";
  if (hasWorsening) return "worsening";
  if (hasImproving) return "improving";
  return "stable";
}

export function thresholdFor(scale: Scale, settings: MetricSettings): number {
  return scale === "phq9" ? settings.phqChangeThreshold : settings.gadChangeThreshold;
}

export function summarizeScale(
  scale: Scale,
  points: AssessmentPoint[],
  settings: MetricSettings,
): ScaleSummary {
  const history = sortChronologically(points.filter((p) => p.scale === scale));
  const { baseline, latest } = pickBaselineAndLatest(history);
  const delta = baseline && latest && history.length > 1 ? latest.score - baseline.score : null;
  return {
    scale,
    history,
    baseline,
    latest,
    delta,
    trend: scaleTrend(delta, thresholdFor(scale, settings)),
    severity: latest ? severityFor(scale, latest.score) : null,
  };
}
