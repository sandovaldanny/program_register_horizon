import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Info } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, severityTone } from "@/components/Badge";
import { FlagChips } from "@/components/FlagChips";
import type { CaseloadRow } from "@/db/queries";
import { DEFAULT_DIR, type CaseloadFilters, type SortKey, filtersToQuery } from "@/lib/filters";
import type { ScaleSummary } from "@/lib/metrics";
import { CENTER_LABELS } from "@/lib/scope";
import { cn } from "@/lib/cn";

export async function PatientTable({
  rows,
  showCenter,
  emptyMessage,
  filters,
  basePath = "/",
}: {
  rows: CaseloadRow[];
  showCenter: boolean;
  emptyMessage: string;
  filters: CaseloadFilters;
  basePath?: string;
}) {
  const t = await getTranslations("table");
  const tEnum = await getTranslations("enums");
  const fmt = await getFormatter();
  const date = (iso: string | null) => (iso ? fmt.dateTime(new Date(`${iso}T00:00:00`), { day: "2-digit", month: "short", year: "numeric" }) : "—");

  const sortHref = (key: SortKey) => {
    const q = filtersToQuery(filters);
    const dir = filters.sort === key ? (filters.dir === "asc" ? "desc" : "asc") : DEFAULT_DIR[key];
    q.set("sort", key);
    q.set("dir", dir);
    return `${basePath}?${q.toString()}`;
  };

  const th = "px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-bluegray";
  const td = "px-4 py-3 align-middle";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-sm">
        <thead className="border-y border-border bg-surface-soft/60">
          <tr>
            <SortHeader keyName="mrn" label={t("patient")} filters={filters} href={sortHref("mrn")} />
            {showCenter ? <th className={th}>{t("center")}</th> : null}
            <SortHeader keyName="phq" label={t("phq")} hint={t("scoreHint")} filters={filters} href={sortHref("phq")} />
            <SortHeader keyName="gad" label={t("gad")} hint={t("scoreHint")} filters={filters} href={sortHref("gad")} />
            <SortHeader keyName="last_score" label={t("lastScore")} filters={filters} href={sortHref("last_score")} />
            <SortHeader keyName="last_session" label={t("lastSession")} filters={filters} href={sortHref("last_session")} />
            <th className={th}>{t("flags")}</th>
            <th className={cn(th, "text-end")}>
              <span className="group relative inline-flex items-center justify-end gap-1">
                <Link href={sortHref("priority")} className={cn("inline-flex items-center gap-1 hover:text-indigo", filters.sort === "priority" && "text-indigo")}>
                  {t("priority")}
                  {filters.sort === "priority" ? (
                    filters.dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />
                  )}
                </Link>
                <button type="button" aria-label={t("priorityHelpLabel")} className="rounded-full text-bluegray hover:text-indigo focus:outline-none">
                  <Info className="h-3.5 w-3.5" aria-hidden />
                </button>
                <span
                  role="tooltip"
                  className="pointer-events-none invisible absolute end-0 top-full z-20 mt-2 w-72 rounded-card border border-border bg-surface p-3 text-start text-xs font-normal normal-case tracking-normal text-indigo opacity-0 shadow-card-hover transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                >
                  <span className="mb-1 block font-semibold">{t("priorityHelpTitle")}</span>
                  <span className="block whitespace-pre-line leading-relaxed">{t("priorityHelp")}</span>
                </span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={showCenter ? 8 : 7} className="px-6 py-12 text-center text-sm text-bluegray">
                {emptyMessage}
              </td>
            </tr>
          ) : null}
          {rows.map(({ patient, derived }) => (
            <tr key={patient.id} className="border-b border-border/60 last:border-0 hover:bg-surface-soft/50">
              <td className={td}>
                <Link href={`/patients/${patient.id}`} className="whitespace-nowrap font-semibold text-indigo hover:text-steel">
                  <span className="ltr-data">{patient.mrn}</span>
                </Link>
                {patient.status !== "active" ? (
                  <Badge tone="neutral" className="ms-2">
                    {tEnum(`status.${patient.status === "inactive" ? "inactive" : "active"}`)}
                  </Badge>
                ) : null}
                <div className="text-xs text-bluegray">
                  {[patient.displayName, patient.age ? `${patient.age} ${t("yearsShort")}` : null, patient.psychiatrist]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </td>
              {showCenter ? <td className={cn(td, "whitespace-nowrap")}>{CENTER_LABELS[patient.center]}</td> : null}
              <td className={td}>
                <ScoreCell summary={derived.phq} label={derived.phq.severity ? tEnum(`severity.${derived.phq.severity}`) : null} />
              </td>
              <td className={td}>
                <ScoreCell summary={derived.gad} label={derived.gad.severity ? tEnum(`severity.${derived.gad.severity}`) : null} />
              </td>
              <td className={cn(td, "whitespace-nowrap")}>
                <span className={cn(derived.assessmentStatus === "overdue" ? "font-semibold text-danger" : "")}>
                  {date(derived.lastScoreDate)}
                </span>
              </td>
              <td className={cn(td, "whitespace-nowrap")}>
                <span className={cn(derived.attendanceStatus === "concern" ? "font-semibold text-danger" : "")}>{date(patient.lastSessionDate)}</span>
              </td>
              <td className={td}>
                <FlagChips flags={derived.flags} max={3} />
              </td>
              <td className={cn(td, "ltr-data text-end font-semibold")}>{derived.priorityScore > 0 ? Math.round(derived.priorityScore) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TH = "px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-bluegray";

function SortHeader({ keyName, label, hint, href, filters }: { keyName: SortKey; label: string; hint?: string; href: string; filters: CaseloadFilters }) {
  const active = filters.sort === keyName;
  const Icon = active ? (filters.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={TH} aria-sort={active ? (filters.dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={href} className={cn("inline-flex items-center gap-1 hover:text-indigo", active && "text-indigo")}>
        {label}
        <Icon className={cn("h-3.5 w-3.5", active ? "opacity-100" : "opacity-40")} aria-hidden />
      </Link>
      {hint ? <span className="block text-[10px] font-medium normal-case tracking-normal text-bluegray/80">{hint}</span> : null}
    </th>
  );
}

/** `baseline → latest` with a delta chip, severity of the latest score underneath. */
function ScoreCell({ summary, label }: { summary: ScaleSummary; label: string | null }) {
  const { baseline, latest, delta, severity } = summary;
  if (!latest) return <span className="text-bluegray">—</span>;
  return (
    <div className="flex flex-col gap-1">
      <span className="ltr-data inline-flex items-center gap-1.5 whitespace-nowrap">
        {baseline && delta !== null ? (
          <>
            <span className="text-bluegray">{baseline.score}</span>
            <span className="text-bluegray/70">→</span>
          </>
        ) : null}
        <span className="text-base font-semibold text-indigo">{latest.score}</span>
        {delta !== null ? (
          <span
            className={cn(
              "rounded-full px-1.5 text-[11px] font-semibold",
              delta < 0 ? "bg-turquoise/25 text-indigo" : delta > 0 ? "bg-danger-soft/60 text-indigo" : "bg-surface-soft text-bluegray",
            )}
          >
            {delta > 0 ? `+${delta}` : delta === 0 ? "±0" : delta}
          </span>
        ) : null}
      </span>
      {label ? <Badge tone={severityTone(severity)}>{label}</Badge> : null}
    </div>
  );
}
