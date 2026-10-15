import { getTranslations } from "next-intl/server";
import { SettingsForm } from "@/components/SettingsForm";
import { getDb } from "@/db";
import { ensureSettings } from "@/db/settings";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const settings = await ensureSettings(getDb());
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-medium text-indigo">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-bluegray">{t("subtitle")}</p>
      </header>
      <SettingsForm settings={settings} />
    </div>
  );
}
