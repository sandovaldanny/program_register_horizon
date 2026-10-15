import type { AssessmentStatus, AttendanceStatus, Flag, PatientInput, Trend } from "./types";

/** Display and evaluation order. */
export const FLAG_ORDER: Flag[] = ["worsening", "no_score", "no_session", "no_baseline"];

export const PRIORITY_WEIGHTS: Record<Flag, number> = {
  worsening: 40,
  no_score: 30,
  no_session: 30,
  no_baseline: 20,
};

/** Manual "High" follow-up priority set by the coordinator adds this on top. */
export const HIGH_PRIORITY_BONUS = 20;

export type FlagInput = {
  patient: PatientInput;
  trend: Trend | null;
  assessmentStatus: AssessmentStatus;
  attendanceStatus: AttendanceStatus;
};

export function computeFlags(input: FlagInput): Flag[] {
  // Only patients still in the programme generate work for the coordinator.
  if (input.patient.status !== "active") return [];

  const set = new Set<Flag>();
  if (input.trend === "worsening" || input.trend === "mixed") set.add("worsening");
  if (input.assessmentStatus === "overdue") set.add("no_score");
  if (input.attendanceStatus === "concern") set.add("no_session");
  if (input.assessmentStatus === "no_scores") set.add("no_baseline");

  return FLAG_ORDER.filter((f) => set.has(f));
}

/**
 * Sum of flag weights (+ manual high-priority bonus) with a small tie-breaker
 * so the longest-overdue patient floats up. 0 when there is nothing to do.
 */
export function priorityScore(
  flags: Flag[],
  daysPastDue: number | null,
  followUpPriority: PatientInput["followUpPriority"] = "routine",
): number {
  const base = flags.reduce((sum, f) => sum + PRIORITY_WEIGHTS[f], 0);
  if (base === 0) return 0;
  const manual = followUpPriority === "high" ? HIGH_PRIORITY_BONUS : 0;
  const overdueBonus = daysPastDue && daysPastDue > 0 ? Math.min(daysPastDue, 90) / 100 : 0;
  return Math.round((base + manual + overdueBonus) * 100) / 100;
}
