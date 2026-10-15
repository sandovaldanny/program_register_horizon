import type { CaseloadRow } from "@/db/queries";
import type { Flag, Severity, Trend } from "@/lib/metrics";
import { severityRank } from "@/lib/metrics/severity";
import { splitNames } from "@/lib/import/normalize";

export const ALERT_FILTERS = [
  "needs_attention",
  "assessment_overdue",
  "assessment_due_soon",
  "attendance_concern",
  "worsening",
  "severe",
  "no_scores",
  "confirm_active",
  "minimal_scores",
  "high_priority",
] as const;
export type AlertFilter = (typeof ALERT_FILTERS)[number];

const SEVERITIES: Severity[] = ["minimal", "mild", "moderate", "moderately_severe", "severe"];
const TRENDS: Trend[] = ["improving", "stable", "worsening", "mixed", "first_score"];
const PRIORITIES = ["routine", "low", "mid", "high"] as const;
const STATUSES = ["active", "inactive", "graduated", "transferred", "all"] as const;
const SORTS = ["priority", "mrn", "last_score", "severity"] as const;

export type CaseloadFilters = {
  q: string;
  status: (typeof STATUSES)[number];
  phqSeverity: Severity | "";
  gadSeverity: Severity | "";
  trend: Trend | "";
  alert: AlertFilter | "";
  clinician: string;
  priority: (typeof PRIORITIES)[number] | "";
  sort: (typeof SORTS)[number];
};

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const oneOf = <T extends string>(v: string, list: readonly T[], fallback: T | ""): T | "" =>
  (list as readonly string[]).includes(v) ? (v as T) : fallback;

export function parseFilters(params: Record<string, string | string[] | undefined>): CaseloadFilters {
  return {
    q: str(params.q).trim(),
    status: oneOf(str(params.status), STATUSES, "active") || "active",
    phqSeverity: oneOf(str(params.phq), SEVERITIES, ""),
    gadSeverity: oneOf(str(params.gad), SEVERITIES, ""),
    trend: oneOf(str(params.trend), TRENDS, ""),
    alert: oneOf(str(params.alert), ALERT_FILTERS, ""),
    clinician: str(params.clinician),
    priority: oneOf(str(params.priority), PRIORITIES, ""),
    sort: oneOf(str(params.sort), SORTS, "priority") || "priority",
  };
}

export function applyFilters(rows: CaseloadRow[], f: CaseloadFilters): CaseloadRow[] {
  const q = f.q.toLowerCase();
  const out = rows.filter(({ patient, derived }) => {
    if (f.status !== "all" && patient.status !== f.status) return false;
    if (f.phqSeverity && derived.phq.severity !== f.phqSeverity) return false;
    if (f.gadSeverity && derived.gad.severity !== f.gadSeverity) return false;
    if (f.trend && derived.trend !== f.trend) return false;
    if (f.priority && patient.followUpPriority !== f.priority) return false;
    if (f.alert === "needs_attention" ? !derived.needsAttention : f.alert && !derived.flags.includes(f.alert as Flag)) return false;
    if (f.clinician) {
      const names = [...splitNames(patient.psychiatrist), ...splitNames(patient.psychologist)];
      if (!names.includes(f.clinician)) return false;
    }
    if (q) {
      const hay = [patient.mrn, patient.displayName ?? "", patient.diagnosis ?? "", patient.psychiatrist ?? "", patient.psychologist ?? ""]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sevRank = (r: CaseloadRow) => (r.derived.maxSeverity ? severityRank(r.derived.maxSeverity) : -1);
  const cmp: Record<CaseloadFilters["sort"], (a: CaseloadRow, b: CaseloadRow) => number> = {
    priority: (a, b) => b.derived.priorityScore - a.derived.priorityScore || a.patient.mrn.localeCompare(b.patient.mrn),
    mrn: (a, b) => a.patient.mrn.localeCompare(b.patient.mrn, undefined, { numeric: true }),
    last_score: (a, b) => (a.derived.lastScoreDate ?? "").localeCompare(b.derived.lastScoreDate ?? ""),
    severity: (a, b) => sevRank(b) - sevRank(a) || b.derived.priorityScore - a.derived.priorityScore,
  };
  return out.sort(cmp[f.sort]);
}
