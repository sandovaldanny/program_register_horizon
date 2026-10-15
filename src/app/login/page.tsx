import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getTranslations("auth");
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex justify-end p-6">
        <LanguageToggle />
      </div>
      <div className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="w-full max-w-md">
          <div className="mb-10 flex flex-col items-center gap-6 text-center">
            <Image src="/alkalma-logo.png" alt="Alkalma" width={180} height={60} priority className="h-auto w-[180px]" />
            <div>
              <h1 className="text-2xl font-medium text-indigo">{t("title")}</h1>
              <p className="mt-2 text-sm text-bluegray">{t("subtitle")}</p>
            </div>
          </div>
          <div className="rounded-card bg-surface p-8 shadow-card">
            <LoginForm next={next} />
          </div>
        </div>
      </div>
    </main>
  );
}
