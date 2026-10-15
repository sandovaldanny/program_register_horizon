import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CalendarX,
  ClipboardList,
  GraduationCap,
  TrendingDown,
  TrendingUp,
  UserX,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { KpiTile } from "@/components/KpiTile";
import { PatientTable } from "@/components/PatientTable";
import { getCaseload } from "@/db/queries";
import { applyFilters, parseFilters } from "@/lib/filters";
import { getCenterScope } from "@/lib/scope-server";
import { scopeToCenter } from "@/lib/scope";

export default async function DashboardPage() {
  const scope = await getCenterScope();
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("centers");
  const { caseload, kpis } = await getCaseload(scopeToCenter(scope));

  const worklist = applyFilters(caseload, parseFilters({ alert: "needs_attention", sort: "priority" })).slice(0, 25);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-bluegray">{tc(scope)}</p>
          <h1 className="mt-1 text-3xl font-medium text-indigo">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-bluegray">{t("subtitle")}</p>
        </div>
        <Link href="/patients/new" className="rounded-control bg-indigo px-5 py-2.5 text-sm font-medium text-white shadow-card hover:bg-indigo-dark">
          {t("addPatient")}
        </Link>
      </header>

      <section aria-label={t("kpi.sectionLabel")} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <KpiTile icon={Users} label={t("kpi.active")} value={kpis.active} hint={t("kpi.ofTotal", { total: kpis.total })} tone="indigo" href="/patients" />
          <KpiTile icon={Bell} label={t("kpi.needsAttention")} value={kpis.needsAttention} tone="danger" highlight href="/patients?alert=needs_attention" />
          <KpiTile icon={CalendarX} label={t("kpi.overdue")} value={kpis.overdue} tone="amber" href="/patients?alert=assessment_overdue" />
          <KpiTile icon={UserX} label={t("kpi.attendance")} value={kpis.attendanceConcern} tone="amber" href="/patients?alert=attendance_concern" />
          <KpiTile icon={TrendingUp} label={t("kpi.worsening")} value={kpis.worsening} tone="danger" href="/patients?alert=worsening" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <KpiTile icon={AlertTriangle} label={t("kpi.severe")} value={kpis.severe} hint={t("kpi.severeHint")} tone="danger" href="/patients?alert=severe" />
          <KpiTile icon={CalendarClock} label={t("kpi.dueSoon")} value={kpis.dueSoon} tone="steel" href="/patients?alert=assessment_due_soon" />
          <KpiTile icon={ClipboardList} label={t("kpi.noScores")} value={kpis.noScores} tone="steel" href="/patients?alert=no_scores" />
          <KpiTile icon={GraduationCap} label={t("kpi.minimal")} value={kpis.minimal} tone="turquoise" href="/patients?alert=minimal_scores" />
          <KpiTile icon={TrendingDown} label={t("kpi.improving")} value={kpis.improving} tone="turquoise" href="/patients?trend=improving" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-medium text-indigo">{t("worklist.title")}</h2>
            <p className="text-sm text-bluegray">{t("worklist.subtitle")}</p>
          </div>
          <Link href="/patients?alert=needs_attention" className="text-sm font-medium text-steel hover:underline">
            {t("worklist.viewAll", { count: kpis.needsAttention })}
          </Link>
        </div>
        <PatientTable rows={worklist} showCenter={scope === "all"} emptyMessage={t("worklist.empty")} compact />
      </section>
    </div>
  );
}
