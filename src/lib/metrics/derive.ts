import { assessmentStatus, attendanceStatus } from "./alerts";
import { ACTIONABLE_FLAGS, computeFlags, priorityScore } from "./flags";
import { tierFromScores } from "./severity";
import { combinedTrend, summarizeScale } from "./trend";
import type { AssessmentPoint, MetricSettings, PatientDerived, PatientInput } from "./types";

/** Single entry point: everything the dashboard, caseload, detail page and export need. */
export function derivePatient(
  patient: PatientInput,
  assessments: AssessmentPoint[],
  settings: MetricSettings,
  today: Date,
): PatientDerived {
  const phq = summarizeScale("phq9", assessments, settings);
  const gad = summarizeScale("gad7", assessments, settings);

  const latestPhq = phq.latest?.score ?? null;
  const latestGad = gad.latest?.score ?? null;
  const tier = tierFromScores(latestPhq, latestGad);
  const trend = combinedTrend(phq.trend, gad.trend, assessments.length > 0);

  const lastScoreDate =
    [phq.latest?.assessedAt, gad.latest?.assessedAt]
      .filter((d): d is string => !!d)
      .sort()
      .at(-1) ?? null;

  const assessment = assessmentStatus(lastScoreDate, settings, today);
  const attendance = attendanceStatus(patient.lastSessionDate, settings, today);

  const flags = computeFlags({
    patient,
    tier,
    trend,
    assessmentStatus: assessment.status,
    attendanceStatus: attendance.status,
    latestPhq,
    latestGad,
  });

  return {
    phq,
    gad,
    tier,
    trend,
    lastScoreDate,
    nextDueDate: assessment.nextDue,
    assessmentStatus: assessment.status,
    daysPastDue: assessment.daysPastDue,
    attendanceStatus: attendance.status,
    daysSinceSession: attendance.daysSince,
    flags,
    needsAttention: flags.some((f) => ACTIONABLE_FLAGS.includes(f)),
    priorityScore: priorityScore(flags, assessment.daysPastDue),
  };
}

export type CaseloadKpis = {
  total: number;
  active: number;
  needsAttention: number;
  overdue: number;
  dueSoon: number;
  attendanceConcern: number;
  worsening: number;
  severe: number;
  noScores: number;
  minimal: number;
};

export function summarizeCaseload(
  rows: Array<{ status: PatientInput["status"]; derived: PatientDerived }>,
): CaseloadKpis {
  const active = rows.filter((r) => r.status === "active");
  const has = (flag: string) => active.filter((r) => r.derived.flags.includes(flag as never)).length;
  return {
    total: rows.length,
    active: active.length,
    needsAttention: active.filter((r) => r.derived.needsAttention).length,
    overdue: has("assessment_overdue"),
    dueSoon: has("assessment_due_soon"),
    attendanceConcern: has("attendance_concern"),
    worsening: has("worsening"),
    severe: has("severe"),
    noScores: has("no_scores"),
    minimal: has("minimal_scores"),
  };
}
