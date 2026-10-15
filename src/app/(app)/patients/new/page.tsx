import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PatientForm } from "@/components/PatientForm";
import { getCatalog, getClinicians } from "@/db/queries";
import { getCenterScope } from "@/lib/scope-server";
import { scopeToCenter } from "@/lib/scope";

export default async function NewPatientPage() {
  const t = await getTranslations("form");
  const td = await getTranslations("detail");
  const scope = await getCenterScope();
  const [clinicians, diagnoses, carePlans] = await Promise.all([getClinicians(), getCatalog("diagnosis"), getCatalog("care_plan")]);
  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <header>
        <Link href="/" className="text-sm font-medium text-steel hover:underline">
          ← {td("backToList")}
        </Link>
        <h1 className="mt-2 text-3xl font-medium text-indigo">{t("newTitle")}</h1>
      </header>
      <PatientForm defaultCenter={scopeToCenter(scope) ?? undefined} clinicians={clinicians} diagnoses={diagnoses} carePlans={carePlans} />
    </div>
  );
}
