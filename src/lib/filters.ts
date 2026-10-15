import type { CaseloadRow } from "@/db/queries";
import type { Flag, Tier, Trend } from "@/lib/metrics";
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

export type CaseloadFilters = {
  q: string;
  status: "active" | "inactive" | "graduated" | "transferred" | "all";
  tier: Tier | "none" | "";
  trend: Trend | "";
  alert: AlertFilter | "";
  clinician: string;
  priority: "routine" | "low" | "mid" | "high" | "";
  sort: "priority" | "mrn" | "last_score" | "tier";
};

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export function parseFilters(params: Record<string, string | string[] | undefined>): CaseloadFilters {
  const status = str(params.status);
  const sort = str(params.sort);
  return {
    q: str(params.q).trim(),
    status: (["active", "inactive", "graduated", "transferred", "all"] as const).includes(status as never)
      ? (status as CaseloadFilters["status"])
      : "active",
    tier: str(params.tier) as CaseloadFilters["tier"],
    trend: str(params.trend) as CaseloadFilters["trend"],
    alert: (ALERT_FILTERS as readonly string[]).includes(str(params.alert)) ? (str(params.alert) as AlertFilter) : "",
    clinician: str(params.clinician),
    priority: str(params.priority) as CaseloadFilters["priority"],
    sort: (["priority", "mrn", "last_score", "tier"] as const).includes(sort as never)
      ? (sort as CaseloadFilters["sort"])
      : "priority",
  };
}

const TIER_RANK: Record<Tier, number> = { tier3: 3, tier2: 2, tier1: 1, minimal: 0 };

export function applyFilters(rows: CaseloadRow[], f: CaseloadFilters): CaseloadRow[] {
  const q = f.q.toLowerCase();
  const out = rows.filter(({ patient, derived }) => {
    if (f.status !== "all" && patient.status !== f.status) return false;
    if (f.tier === "none" ? derived.tier !== null : f.tier && derived.tier !== f.tier) return false;
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

  const cmp: Record<CaseloadFilters["sort"], (a: CaseloadRow, b: CaseloadRow) => number> = {
    priority: (a, b) => b.derived.priorityScore - a.derived.priorityScore || a.patient.mrn.localeCompare(b.patient.mrn),
    mrn: (a, b) => a.patient.mrn.localeCompare(b.patient.mrn, undefined, { numeric: true }),
    last_score: (a, b) => (a.derived.lastScoreDate ?? "").localeCompare(b.derived.lastScoreDate ?? ""),
    tier: (a, b) =>
      (b.derived.tier ? TIER_RANK[b.derived.tier] : -1) - (a.derived.tier ? TIER_RANK[a.derived.tier] : -1) ||
      b.derived.priorityScore - a.derived.priorityScore,
  };
  return out.sort(cmp[f.sort]);
}
