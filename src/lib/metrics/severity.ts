import type { Scale, Severity, Tier } from "./types";

export const SCALE_MAX: Record<Scale, number> = { phq9: 27, gad7: 21 };

/** PHQ-9: 0–4 minimal, 5–9 mild, 10–14 moderate, 15–19 moderately severe, 20+ severe. */
export function phqSeverity(score: number): Severity {
  if (score <= 4) return "minimal";
  if (score <= 9) return "mild";
  if (score <= 14) return "moderate";
  if (score <= 19) return "moderately_severe";
  return "severe";
}

/** GAD-7: 0–4 minimal, 5–9 mild, 10–14 moderate, 15+ severe. */
export function gadSeverity(score: number): Severity {
  if (score <= 4) return "minimal";
  if (score <= 9) return "mild";
  if (score <= 14) return "moderate";
  return "severe";
}

export function severityFor(scale: Scale, score: number): Severity {
  return scale === "phq9" ? phqSeverity(score) : gadSeverity(score);
}

/**
 * Horizon tier from the higher of the latest PHQ-9 / GAD-7:
 * <5 minimal, 5–9 tier 1 (mild), 10–14 tier 2 (moderate), 15+ tier 3 (severe).
 */
export function tierFromScores(latestPhq: number | null, latestGad: number | null): Tier | null {
  const values = [latestPhq, latestGad].filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  const max = Math.max(...values);
  if (max <= 4) return "minimal";
  if (max <= 9) return "tier1";
  if (max <= 14) return "tier2";
  return "tier3";
}
