"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { setCenterScopeAction } from "@/actions/preferences";
import { cn } from "@/lib/cn";
import { CENTER_SCOPES, type CenterScope as Scope } from "@/lib/scope";

export function CenterScope({ value }: { value: Scope }) {
  const t = useTranslations("centers");
  const [pending, start] = useTransition();

  return (
    <div role="group" aria-label={t("scope")} className="flex flex-col gap-1">
      {CENTER_SCOPES.map((s) => (
        <button
          key={s}
          type="button"
          disabled={pending}
          onClick={() => start(() => setCenterScopeAction(s))}
          className={cn(
            "rounded-control px-3 py-2 text-start text-sm transition-colors",
            s === value ? "bg-turquoise/25 font-semibold text-indigo" : "text-white/80 hover:bg-white/10",
          )}
        >
          {t(s)}
        </button>
      ))}
    </div>
  );
}
