import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  const t = await getTranslations("nav");
  return <h1 className="text-3xl font-medium text-indigo">{t("dashboard")}</h1>;
}
