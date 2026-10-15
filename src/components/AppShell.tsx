import Image from "next/image";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { logoutAction } from "@/actions/auth";
import { CenterScope } from "@/components/CenterScope";
import { LanguageToggle } from "@/components/LanguageToggle";
import { NavLinks } from "@/components/NavLinks";
import type { CenterScope as Scope } from "@/lib/scope";

export async function AppShell({ scope, children }: { scope: Scope; children: ReactNode }) {
  const t = await getTranslations("nav");

  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-64 shrink-0 flex-col bg-brand text-white lg:flex">
        <div className="px-6 pt-8 pb-6">
          <div className="rounded-card bg-white px-4 py-3">
            <Image src="/alkalma-logo.png" alt="Alkalma" width={140} height={46} className="h-auto w-[140px]" priority />
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wider text-white/70">{t("programme")}</p>
        </div>

        <nav className="flex flex-col gap-1 px-4">
          <NavLinks />
        </nav>

        <div className="mt-8 px-4">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-white/60">{t("center")}</p>
          <CenterScope value={scope} />
        </div>

        <div className="mt-auto px-4 pb-6">
          <form action={logoutAction}>
            <button type="submit" className="w-full rounded-control px-3 py-2 text-start text-sm text-white/80 hover:bg-white/10">
              {t("signOut")}
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-surface/80 px-6 py-4 backdrop-blur lg:px-10">
          <div className="flex items-center gap-3 lg:hidden">
            <Image src="/alkalma-logo.png" alt="Alkalma" width={110} height={36} className="h-auto w-[110px]" />
          </div>
          <div className="hidden lg:block" />
          <LanguageToggle />
        </header>
        <main className="flex-1 px-6 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
