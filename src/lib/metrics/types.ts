export type Scale = "phq9" | "gad7";

export type Severity = "minimal" | "mild" | "moderate" | "moderately_severe" | "severe";

export type ScaleTrend = "improving" | "stable" | "worsening";

export type Trend = ScaleTrend | "mixed" | "first_score";

export type AssessmentStatus = "no_scores" | "ok" | "due_soon" | "overdue" | "confirm_active";

export type AttendanceStatus = "ok" | "concern" | "unknown";

export type Flag =
  | "high_priority"
  | "worsening"
  | "severe"
  | "assessment_overdue"
  | "assessment_due_soon"
  | "confirm_active"
  | "attendance_concern"
  | "no_scores"
  | "minimal_scores"
  | "care_plan_missing";

/** Subset of the settings row the metrics need. Pure, DB-agnostic. */
export type MetricSettings = {
  phqChangeThreshold: number;
  gadChangeThreshold: number;
  checkIntervalMonths: number;
  dueSoonDays: number;
  confirmActiveDays: number;
  attendanceConcernDays: number;
};

export const DEFAULT_METRIC_SETTINGS: MetricSettings = {
  phqChangeThreshold: 5,
  gadChangeThreshold: 4,
  checkIntervalMonths: 1,
  dueSoonDays: 7,
  confirmActiveDays: 60,
  attendanceConcernDays: 30,
};

/** One screening as the metrics see it. `assessedAt` is an ISO date (YYYY-MM-DD). */
export type AssessmentPoint = {
  id: string;
  scale: Scale;
  score: number;
  assessedAt: string;
  dateSource: "recorded" | "estimated";
  /** ISO timestamp; used only as a tie-breaker when two points share a date. */
  createdAt: string;
};

/** Subset of the patient row the metrics need. */
export type PatientInput = {
  status: "active" | "inactive" | "graduated" | "transferred";
  followUpPriority: "routine" | "low" | "mid" | "high";
  lastSessionDate: string | null;
  carePlan: string | null;
};

export type ScaleSummary = {
  scale: Scale;
  history: AssessmentPoint[];
  baseline: AssessmentPoint | null;
  latest: AssessmentPoint | null;
  delta: number | null;
  trend: ScaleTrend | null;
  severity: Severity | null;
};

export type PatientDerived = {
  phq: ScaleSummary;
  gad: ScaleSummary;
  /** Worst of the two latest severities (by band rank), null without scores. */
  maxSeverity: Severity | null;
  /** True when PHQ-9 ≥ 15 (moderately severe or severe) or GAD-7 ≥ 15 (severe). */
  severeRange: boolean;
  trend: Trend | null;
  lastScoreDate: string | null;
  nextDueDate: string | null;
  assessmentStatus: AssessmentStatus;
  /** Positive when past due, negative when still in the future. */
  daysPastDue: number | null;
  attendanceStatus: AttendanceStatus;
  daysSinceSession: number | null;
  flags: Flag[];
  /** True when at least one actionable flag is set (see ACTIONABLE_FLAGS). */
  needsAttention: boolean;
  priorityScore: number;
};
