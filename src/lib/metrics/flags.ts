import type { AssessmentStatus, AttendanceStatus, Flag, PatientInput, Tier, Trend } from "./types";

/** Order matters: it is the display order of the chips and the evaluation order. */
export const FLAG_ORDER: Flag[] = [
  "high_priority",
  "worsening",
  "severe",
  "assessment_overdue",
  "assessment_due_soon",
  "confirm_active",
  "attendance_concern",
  "no_scores",
  "minimal_scores",
  "care_plan_missing",
];

/** Flags that put a patient on the "needs attention" worklist. `care_plan_missing` is informational only. */
export const ACTIONABLE_FLAGS: Flag[] = FLAG_ORDER.filter((f) => f !== "care_plan_missing");

export const PRIORITY_WEIGHTS: Record<Flag, number> = {
  high_priority: 40,
  worsening: 30,
  severe: 20,
  assessment_overdue: 15,
  attendance_concern: 15,
  confirm_active: 10,
  no_scores: 8,
  assessment_due_soon: 5,
  minimal_scores: 3,
  care_plan_missing: 2,
};

export type FlagInput = {
  patient: PatientInput;
  tier: Tier | null;
  trend: Trend | null;
  assessmentStatus: AssessmentStatus;
  attendanceStatus: AttendanceStatus;
  latestPhq: number | null;
  latestGad: number | null;
};

export function computeFlags(input: FlagInput): Flag[] {
  // Only patients still in the programme generate work for the coordinator.
  if (input.patient.status !== "active") return [];

  const set = new Set<Flag>();
  if (input.patient.followUpPriority === "high") set.add("high_priority");
  if (input.trend === "worsening" || input.trend === "mixed") set.add("worsening");
  if (input.tier === "tier3") set.add("severe");

  switch (input.assessmentStatus) {
    case "overdue":
      set.add("assessment_overdue");
      break;
    case "due_soon":
      set.add("assessment_due_soon");
      break;
    case "confirm_active":
      set.add("assessment_overdue");
      set.add("confirm_active");
      break;
    case "no_scores":
      set.add("no_scores");
      break;
  }

  if (input.attendanceStatus === "concern") set.add("attendance_concern");

  const latest = [input.latestPhq, input.latestGad].filter((v): v is number => v !== null);
  if (latest.length > 0 && latest.every((v) => v < 5)) set.add("minimal_scores");

  if (!input.patient.carePlan || input.patient.carePlan.trim() === "") set.add("care_plan_missing");

  return FLAG_ORDER.filter((f) => set.has(f));
}

/** Additive weights plus a small tie-breaker so the longest-overdue patient floats up. */
export function priorityScore(flags: Flag[], daysPastDue: number | null): number {
  const base = flags.reduce((sum, f) => sum + PRIORITY_WEIGHTS[f], 0);
  if (base === 0) return 0;
  const overdueBonus = daysPastDue && daysPastDue > 0 ? Math.min(daysPastDue, 90) / 100 : 0;
  return Math.round((base + overdueBonus) * 100) / 100;
}
