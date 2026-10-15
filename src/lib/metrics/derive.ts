import { assessmentStatus, attendanceStatus } from "./alerts";
import { computeFlags, priorityScore } from "./flags";
import { isSevereRange, maxSeverity } from "./severity";
import { combinedTrend, summarizeScale } from "./trend";
import type { AssessmentPoint, Flag, MetricSettings, PatientDerived, PatientInput } from "./types";

/** Single entry point: everything the dashboard, detail page and export need. */
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
    trend,
    assessmentStatus: assessment.status,
    attendanceStatus: attendance.status,
  });

  const latest = [latestPhq, latestGad].filter((v): v is number => v !== null);

  return {
    phq,
    gad,
    maxSeverity: maxSeverity(phq.severity, gad.severity),
    severeRange: isSevereRange(latestPhq, latestGad),
    graduationCandidate: patient.status === "active" && latest.length > 0 && latest.every((v) => v < 5),
    trend,
    lastScoreDate,
    nextDueDate: assessment.nextDue,
    assessmentStatus: assessment.status,
    daysPastDue: assessment.daysPastDue,
    attendanceStatus: attendance.status,
    daysSinceSession: attendance.daysSince,
    flags,
    needsAttention: flags.length > 0,
    priorityScore: priorityScore(flags, assessment.daysPastDue, patient.followUpPriority),
  };
}

export type CaseloadKpis = {
  total: number;
  active: number;
  needsAttention: number;
  worsening: number;
  noScore: number;
  noSession: number;
  noBaseline: number;
  improving: number;
  graduationCandidates: number;
};

export function summarizeCaseload(
  rows: Array<{ status: PatientInput["status"]; derived: PatientDerived }>,
): CaseloadKpis {
  const active = rows.filter((r) => r.status === "active");
  const has = (flag: Flag) => active.filter((r) => r.derived.flags.includes(flag)).length;
  return {
    total: rows.length,
    active: active.length,
    needsAttention: active.filter((r) => r.derived.needsAttention).length,
    worsening: has("worsening"),
    noScore: has("no_score"),
    noSession: has("no_session"),
    noBaseline: has("no_baseline"),
    improving: active.filter((r) => r.derived.trend === "improving").length,
    graduationCandidates: active.filter((r) => r.derived.graduationCandidate).length,
  };
}
