import type { Scale, Severity } from "./types";

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

export const SEVERITY_ORDER: Severity[] = ["minimal", "mild", "moderate", "moderately_severe", "severe"];

export const severityRank = (s: Severity): number => SEVERITY_ORDER.indexOf(s);

/** Worst of the given severities, or null if none. */
export function maxSeverity(...values: Array<Severity | null>): Severity | null {
  const present = values.filter((v): v is Severity => v !== null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => (severityRank(b) > severityRank(a) ? b : a));
}

/**
 * "Severe range": PHQ-9 moderately severe / severe (≥15) or GAD-7 severe (≥15).
 * Matches the Horizon rule that a score of 15 or more on either scale needs clinician attention.
 */
export function isSevereRange(latestPhq: number | null, latestGad: number | null): boolean {
  const phq = latestPhq !== null ? phqSeverity(latestPhq) : null;
  const gad = latestGad !== null ? gadSeverity(latestGad) : null;
  return phq === "moderately_severe" || phq === "severe" || gad === "severe";
}
