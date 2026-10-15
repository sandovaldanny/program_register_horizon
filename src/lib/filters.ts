import type { CaseloadRow } from "@/db/queries";
import type { Flag, Severity, Trend } from "@/lib/metrics";
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
export const STATUS_FILTERS = ["active", "inactive", "all"] as const;
export const SORT_KEYS = ["priority", "mrn", "phq", "gad", "last_score", "last_session"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export type CaseloadFilters = {
  q: string;
  status: (typeof STATUS_FILTERS)[number];
  phqSeverity: Severity | "";
  gadSeverity: Severity | "";
  /** Not exposed as a control; reachable from the "Improving" KPI. */
  trend: Trend | "";
  alert: AlertFilter | "";
  clinician: string;
  priority: (typeof PRIORITIES)[number] | "";
  sort: SortKey;
  dir: SortDir;
};

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const oneOf = <T extends string>(v: string, list: readonly T[], fallback: T | ""): T | "" =>
  (list as readonly string[]).includes(v) ? (v as T) : fallback;

/** Natural direction when a column is first clicked. */
export const DEFAULT_DIR: Record<SortKey, SortDir> = {
  priority: "desc",
  mrn: "asc",
  phq: "desc",
  gad: "desc",
  last_score: "asc",
  last_session: "asc",
};

export function parseFilters(params: Record<string, string | string[] | undefined>): CaseloadFilters {
  const sort = (oneOf(str(params.sort), SORT_KEYS, "priority") || "priority") as SortKey;
  const dir = (oneOf(str(params.dir), ["asc", "desc"] as const, "") || DEFAULT_DIR[sort]) as SortDir;
  return {
    q: str(params.q).trim(),
    status: (oneOf(str(params.status), STATUS_FILTERS, "active") || "active") as CaseloadFilters["status"],
    phqSeverity: oneOf(str(params.phq), SEVERITIES, ""),
    gadSeverity: oneOf(str(params.gad), SEVERITIES, ""),
    trend: oneOf(str(params.trend), TRENDS, ""),
    alert: oneOf(str(params.alert), ALERT_FILTERS, ""),
    clinician: str(params.clinician),
    priority: oneOf(str(params.priority), PRIORITIES, ""),
    sort,
    dir,
  };
}

/** Query string for the current filters (no sort/dir), used to build sortable header links. */
export function filtersToQuery(f: CaseloadFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.status !== "active") p.set("status", f.status);
  if (f.phqSeverity) p.set("phq", f.phqSeverity);
  if (f.gadSeverity) p.set("gad", f.gadSeverity);
  if (f.trend) p.set("trend", f.trend);
  if (f.alert) p.set("alert", f.alert);
  if (f.clinician) p.set("clinician", f.clinician);
  if (f.priority) p.set("priority", f.priority);
  return p;
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

  const num = (v: number | null | undefined) => (v === null || v === undefined ? Number.NEGATIVE_INFINITY : v);
  const text = (v: string | null | undefined) => v ?? "";
  const key: Record<SortKey, (r: CaseloadRow) => number | string> = {
    priority: (r) => r.derived.priorityScore,
    mrn: (r) => r.patient.mrn,
    phq: (r) => num(r.derived.phq.latest?.score),
    gad: (r) => num(r.derived.gad.latest?.score),
    last_score: (r) => text(r.derived.lastScoreDate),
    last_session: (r) => text(r.patient.lastSessionDate),
  };
  const get = key[f.sort];
  const sign = f.dir === "asc" ? 1 : -1;
  return out.sort((a, b) => {
    const x = get(a);
    const y = get(b);
    let c = 0;
    if (typeof x === "number" && typeof y === "number") c = x - y;
    else c = String(x).localeCompare(String(y), undefined, { numeric: true });
    if (c === 0) c = b.derived.priorityScore - a.derived.priorityScore || a.patient.mrn.localeCompare(b.patient.mrn, undefined, { numeric: true });
    return c * sign;
  });
}
