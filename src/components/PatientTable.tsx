import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge, tierTone, trendTone } from "@/components/Badge";
import { FlagChips } from "@/components/FlagChips";
import type { CaseloadRow } from "@/db/queries";
import { CENTER_LABELS } from "@/lib/scope";
import { cn } from "@/lib/cn";

export async function PatientTable({
  rows,
  showCenter,
  emptyMessage,
  compact = false,
}: {
  rows: CaseloadRow[];
  showCenter: boolean;
  emptyMessage: string;
  compact?: boolean;
}) {
  const t = await getTranslations("table");
  const tEnum = await getTranslations("enums");
  const fmt = await getFormatter();
  const date = (iso: string | null) => (iso ? fmt.dateTime(new Date(`${iso}T00:00:00`), { day: "2-digit", month: "short", year: "numeric" }) : "—");

  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border bg-surface px-6 py-12 text-center text-sm text-bluegray">
        {emptyMessage}
      </div>
    );
  }

  const th = "px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-bluegray";
  const td = cn("px-4 align-middle", compact ? "py-2.5" : "py-3.5");

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
      <table className="w-full min-w-[960px] border-collapse text-sm">
        <thead className="border-b border-border bg-surface-soft/60">
          <tr>
            <th className={th}>{t("patient")}</th>
            {showCenter ? <th className={th}>{t("center")}</th> : null}
            <th className={th}>{t("tier")}</th>
            <th className={th}>{t("phq")}</th>
            <th className={th}>{t("gad")}</th>
            <th className={th}>{t("trend")}</th>
            <th className={th}>{t("lastScore")}</th>
            <th className={th}>{t("lastSession")}</th>
            <th className={th}>{t("flags")}</th>
            <th className={cn(th, "text-end")}>{t("priority")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ patient, derived }) => (
            <tr key={patient.id} className="border-b border-border/60 last:border-0 hover:bg-surface-soft/50">
              <td className={td}>
                <Link href={`/patients/${patient.id}`} className="whitespace-nowrap font-semibold text-indigo hover:text-steel">
                  <span className="ltr-data">{patient.mrn}</span>
                </Link>
                <div className="text-xs text-bluegray">
                  {[patient.displayName, patient.age ? `${patient.age} ${t("yearsShort")}` : null, patient.psychiatrist]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </td>
              {showCenter ? <td className={cn(td, "whitespace-nowrap")}>{CENTER_LABELS[patient.center]}</td> : null}
              <td className={td}>
                {derived.tier ? <Badge tone={tierTone(derived.tier)}>{tEnum(`tier.${derived.tier}`)}</Badge> : <span className="text-bluegray">—</span>}
              </td>
              <td className={cn(td, "ltr-data")}>
                <ScoreCell baseline={derived.phq.baseline?.score} latest={derived.phq.latest?.score} delta={derived.phq.delta} />
              </td>
              <td className={cn(td, "ltr-data")}>
                <ScoreCell baseline={derived.gad.baseline?.score} latest={derived.gad.latest?.score} delta={derived.gad.delta} />
              </td>
              <td className={td}>
                {derived.trend ? <Badge tone={trendTone(derived.trend)}>{tEnum(`trend.${derived.trend}`)}</Badge> : <span className="text-bluegray">—</span>}
              </td>
              <td className={cn(td, "whitespace-nowrap")}>
                <span className={cn(derived.assessmentStatus === "overdue" || derived.assessmentStatus === "confirm_active" ? "font-semibold text-danger" : "")}>
                  {date(derived.lastScoreDate)}
                </span>
              </td>
              <td className={cn(td, "whitespace-nowrap")}>
                <span className={cn(derived.attendanceStatus === "concern" ? "font-semibold text-danger" : "")}>{date(patient.lastSessionDate)}</span>
              </td>
              <td className={td}>
                <FlagChips flags={derived.flags} max={compact ? 2 : 3} />
              </td>
              <td className={cn(td, "ltr-data text-end font-semibold")}>{derived.priorityScore > 0 ? Math.round(derived.priorityScore) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoreCell({ baseline, latest, delta }: { baseline?: number; latest?: number; delta: number | null }) {
  if (latest === undefined) return <span className="text-bluegray">—</span>;
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="font-semibold">{latest}</span>
      {baseline !== undefined && delta !== null ? (
        <span className={cn("text-xs", delta < 0 ? "text-turquoise-dark" : delta > 0 ? "text-danger" : "text-bluegray")}>
          {delta > 0 ? `+${delta}` : delta} <span className="text-bluegray">({baseline})</span>
        </span>
      ) : (
        <span className="text-xs text-bluegray">·</span>
      )}
    </span>
  );
}
