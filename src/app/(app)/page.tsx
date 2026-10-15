import Link from "next/link";
import { Bell, CalendarX, ClipboardList, Download, GraduationCap, TrendingDown, TrendingUp, UserX, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CaseloadFilters } from "@/components/CaseloadFilters";
import { KpiTile } from "@/components/KpiTile";
import { PatientTable } from "@/components/PatientTable";
import { getCaseload, listClinicians } from "@/db/queries";
import { applyFilters, filtersToQuery, parseFilters } from "@/lib/filters";
import { getCenterScope } from "@/lib/scope-server";
import { scopeToCenter } from "@/lib/scope";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const scope = await getCenterScope();
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("centers");
  const { caseload, kpis } = await getCaseload(scopeToCenter(scope));
  const filters = parseFilters(params);
  const rows = applyFilters(caseload, filters);
  const clinicians = listClinicians(caseload.map((r) => r.patient));
  const exportQs = filtersToQuery(filters).toString();

  return (
    <div className="flex flex-col gap-8">
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

      <section aria-label={t("kpi.sectionLabel")} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiTile icon={Users} label={t("kpi.active")} value={kpis.active} hint={t("kpi.ofTotal", { total: kpis.total })} tone="indigo" href="/" />
          <KpiTile icon={Bell} label={t("kpi.needsAttention")} value={kpis.needsAttention} tone="danger" highlight href="/?alert=needs_attention" />
          <KpiTile icon={TrendingUp} label={t("kpi.worsening")} value={kpis.worsening} tone="danger" href="/?alert=worsening" />
          <KpiTile icon={CalendarX} label={t("kpi.noScore")} value={kpis.noScore} tone="amber" href="/?alert=no_score" />
          <KpiTile icon={UserX} label={t("kpi.noSession")} value={kpis.noSession} tone="amber" href="/?alert=no_session" />
          <KpiTile icon={ClipboardList} label={t("kpi.noBaseline")} value={kpis.noBaseline} tone="steel" href="/?alert=no_baseline" />
          <KpiTile icon={TrendingDown} label={t("kpi.improving")} value={kpis.improving} tone="turquoise" href="/?trend=improving" />
          <KpiTile icon={GraduationCap} label={t("kpi.graduation")} value={kpis.graduationCandidates} hint={t("kpi.graduationHint")} tone="turquoise" href="/?graduation=1" />
      </section>

      <section className="rounded-card border border-border bg-surface shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-2">
          <div>
            <h2 className="text-lg font-medium text-indigo">{t("table.title")}</h2>
            <p className="text-xs text-bluegray">{t("table.count", { shown: rows.length, total: caseload.length })}</p>
          </div>
          <div className="flex gap-2">
            <a href={`/api/export?format=csv&${exportQs}`} className="inline-flex items-center gap-1.5 rounded-control border border-border px-3 py-1.5 text-xs font-medium text-indigo hover:border-indigo">
              <Download className="h-3.5 w-3.5" aria-hidden /> CSV
            </a>
            <a href={`/api/export?format=xlsx&${exportQs}`} className="inline-flex items-center gap-1.5 rounded-control border border-border px-3 py-1.5 text-xs font-medium text-indigo hover:border-indigo">
              <Download className="h-3.5 w-3.5" aria-hidden /> Excel
            </a>
          </div>
        </div>
        <CaseloadFilters filters={filters} clinicians={[...clinicians.psychiatrists, ...clinicians.psychologists]} />
        <PatientTable rows={rows} showCenter={scope === "all"} emptyMessage={t("table.empty")} filters={filters} basePath="/" />
      </section>
    </div>
  );
}
