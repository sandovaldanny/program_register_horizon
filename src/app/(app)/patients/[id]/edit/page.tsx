import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PatientForm } from "@/components/PatientForm";
import { getPatientDetail } from "@/db/queries";

export default async function EditPatientPage({ params }: PageProps<"/patients/[id]/edit">) {
  const { id } = await params;
  const detail = await getPatientDetail(id);
  if (!detail) notFound();
  const t = await getTranslations("form");
  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <header>
        <Link href={`/patients/${id}`} className="text-sm font-medium text-steel hover:underline">
          ← <span className="ltr-data">{detail.patient.mrn}</span>
        </Link>
        <h1 className="mt-2 text-3xl font-medium text-indigo">{t("editTitle")}</h1>
      </header>
      <PatientForm patient={detail.patient} />
    </div>
  );
}
