"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { setLocaleAction } from "@/actions/preferences";
import { LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { cn } from "@/lib/cn";

export function LanguageToggle({ className }: { className?: string }) {
  const locale = useLocale();
  const [pending, start] = useTransition();

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn("inline-flex rounded-full border border-border bg-surface p-1", className)}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          disabled={pending}
          onClick={() => start(() => setLocaleAction(l))}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            l === locale ? "bg-indigo text-white" : "text-indigo hover:bg-surface-soft",
          )}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
