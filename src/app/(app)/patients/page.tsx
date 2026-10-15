import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CaseloadFilters } from "@/components/CaseloadFilters";
import { PatientTable } from "@/components/PatientTable";
import { getCaseload, listClinicians } from "@/db/queries";
import { applyFilters, parseFilters } from "@/lib/filters";
import { getCenterScope } from "@/lib/scope-server";
import { scopeToCenter } from "@/lib/scope";

export default async function PatientsPage({ searchParams }: PageProps<"/patients">) {
  const params = await searchParams;
  const scope = await getCenterScope();
  const t = await getTranslations("patients");
  const tc = await getTranslations("centers");
  const { caseload } = await getCaseload(scopeToCenter(scope));
  const filters = parseFilters(params);
  const rows = applyFilters(caseload, filters);
  const clinicians = listClinicians(caseload.map((r) => r.patient));

  const exportQs = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && v ? [[k, v]] : [])),
  ).toString();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-bluegray">{tc(scope)}</p>
          <h1 className="mt-1 text-3xl font-medium text-indigo">{t("title")}</h1>
          <p className="mt-2 text-sm text-bluegray">{t("count", { shown: rows.length, total: caseload.length })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/export?format=csv&${exportQs}`} className="rounded-control border border-indigo px-4 py-2.5 text-sm font-medium text-indigo hover:bg-indigo hover:text-white">
            {t("exportCsv")}
          </a>
          <a href={`/api/export?format=xlsx&${exportQs}`} className="rounded-control border border-indigo px-4 py-2.5 text-sm font-medium text-indigo hover:bg-indigo hover:text-white">
            {t("exportXlsx")}
          </a>
          <Link href="/patients/new" className="rounded-control bg-indigo px-5 py-2.5 text-sm font-medium text-white shadow-card hover:bg-indigo-dark">
            {t("addPatient")}
          </Link>
        </div>
      </header>

      <CaseloadFilters filters={filters} clinicians={[...clinicians.psychiatrists, ...clinicians.psychologists]} />

      <PatientTable rows={rows} showCenter={scope === "all"} emptyMessage={t("empty")} />
    </div>
  );
}
