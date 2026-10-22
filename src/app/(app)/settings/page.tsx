import { getTranslations } from "next-intl/server";
import { CatalogManager } from "@/components/CatalogManager";
import { CliniciansManager } from "@/components/CliniciansManager";
import { SettingsForm } from "@/components/SettingsForm";
import { getCatalog, getClinicians } from "@/db/queries";
import { getDb } from "@/db";
import { ensureSettings } from "@/db/settings";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const settings = await ensureSettings(getDb());
  const [clinicians, diagnoses, carePlans, goalCategories, unenrollReasons] = await Promise.all([getClinicians(), getCatalog("diagnosis"), getCatalog("care_plan"), getCatalog("goal_category"), getCatalog("unenroll_reason")]);
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-medium text-indigo">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-bluegray">{t("subtitle")}</p>
      </header>
      <section className="flex max-w-3xl flex-col gap-4">
        <div>
          <h2 className="text-xl font-medium text-indigo">{t("clinicians.title")}</h2>
          <p className="text-sm text-bluegray">{t("clinicians.subtitle")}</p>
        </div>
        <CliniciansManager items={clinicians} />
      </section>
      <section className="flex max-w-3xl flex-col gap-4">
        <div>
          <h2 className="text-xl font-medium text-indigo">{t("catalog.diagnosisTitle")}</h2>
          <p className="text-sm text-bluegray">{t("catalog.diagnosisSubtitle")}</p>
        </div>
        <CatalogManager kind="diagnosis" items={diagnoses} />
      </section>
      <section className="flex max-w-3xl flex-col gap-4">
        <div>
          <h2 className="text-xl font-medium text-indigo">{t("catalog.carePlanTitle")}</h2>
          <p className="text-sm text-bluegray">{t("catalog.carePlanSubtitle")}</p>
        </div>
        <CatalogManager kind="care_plan" items={carePlans} />
      </section>
      <section className="flex max-w-3xl flex-col gap-4">
        <div>
          <h2 className="text-xl font-medium text-indigo">{t("catalog.goalCategoryTitle")}</h2>
          <p className="text-sm text-bluegray">{t("catalog.goalCategorySubtitle")}</p>
        </div>
        <CatalogManager kind="goal_category" items={goalCategories} />
      </section>
      <section className="flex max-w-3xl flex-col gap-4">
        <div>
          <h2 className="text-xl font-medium text-indigo">{t("catalog.unenrollReasonTitle")}</h2>
          <p className="text-sm text-bluegray">{t("catalog.unenrollReasonSubtitle")}</p>
        </div>
        <CatalogManager kind="unenroll_reason" items={unenrollReasons} />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-medium text-indigo">{t("rulesTitle")}</h2>
        <SettingsForm settings={settings} />
      </section>
    </div>
  );
}
