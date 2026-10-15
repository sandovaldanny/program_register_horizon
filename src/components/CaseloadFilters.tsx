"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { ALERT_FILTERS, STATUS_FILTERS, type CaseloadFilters as Filters } from "@/lib/filters";
import { cn } from "@/lib/cn";

const PHQ_SEVERITIES = ["severe", "moderately_severe", "moderate", "mild", "minimal"] as const;
const GAD_SEVERITIES = ["severe", "moderate", "mild", "minimal"] as const;
const PRIORITIES = ["high", "mid", "low", "routine"] as const;

const control =
  "h-9 rounded-control border border-border bg-surface px-3 text-xs text-indigo focus:border-turquoise focus:outline-none";

export function CaseloadFilters({ filters, clinicians }: { filters: Filters; clinicians: string[] }) {
  const t = useTranslations("filters");
  const tEnum = useTranslations("enums");
  const tFlags = useTranslations("flags");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(filters.q);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`${pathname}?${next.toString()}`));
  };

  useEffect(() => {
    if (q === filters.q) return;
    const id = setTimeout(() => set("q", q), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = [filters.q, filters.alert, filters.phqSeverity, filters.gadSeverity, filters.clinician, filters.priority, filters.trend, filters.graduation ? "g" : "", filters.status !== "active" ? "s" : ""].filter(Boolean).length;

  const select = (id: string, label: string, value: string, key: string, options: Array<[string, string]>, anyLabel = t("any")) => (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">{label}</span>
      <select id={id} aria-label={label} value={value} onChange={(e) => set(key, e.target.value)} className={cn(control, "appearance-none pe-7", value && "border-indigo/40 bg-indigo/5 font-medium")}>
        <option value="">{anyLabel}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 px-5 py-3" aria-busy={pending}>
      <label className="relative flex items-center">
        <Search className="pointer-events-none absolute start-2.5 h-3.5 w-3.5 text-bluegray" aria-hidden />
        <span className="sr-only">{t("search")}</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} className={cn(control, "w-56 ps-8")} />
      </label>
      {select("f-alert", t("alert"), filters.alert, "alert", ALERT_FILTERS.map((a) => [a, a === "needs_attention" ? t("needsAttention") : tFlags(a)]), t("alertAny"))}
      {select("f-phq", t("phqSeverity"), filters.phqSeverity, "phq", PHQ_SEVERITIES.map((v) => [v, tEnum(`severity.${v}`)]), t("phqAny"))}
      {select("f-gad", t("gadSeverity"), filters.gadSeverity, "gad", GAD_SEVERITIES.map((v) => [v, tEnum(`severity.${v}`)]), t("gadAny"))}
      {select("f-clinician", t("clinician"), filters.clinician, "clinician", clinicians.map((c) => [c, c]), t("clinicianAny"))}
      {select("f-priority", t("priority"), filters.priority, "priority", PRIORITIES.map((v) => [v, tEnum(`priority.${v}`)]), t("priorityAny"))}
      <label className="flex items-center gap-1.5">
        <span className="sr-only">{t("status")}</span>
        <select aria-label={t("status")} value={filters.status} onChange={(e) => set("status", e.target.value === "active" ? "" : e.target.value)} className={cn(control, "appearance-none pe-7", filters.status !== "active" && "border-indigo/40 bg-indigo/5 font-medium")}>
          {STATUS_FILTERS.map((v) => (
            <option key={v} value={v}>
              {v === "all" ? t("allStatuses") : tEnum(`status.${v}`)}
            </option>
          ))}
        </select>
      </label>
      {active > 0 ? (
        <button type="button" onClick={() => start(() => router.replace(pathname))} className="inline-flex h-9 items-center gap-1 rounded-control px-2.5 text-xs font-medium text-steel hover:bg-surface-soft">
          <X className="h-3.5 w-3.5" aria-hidden />
          {t("clear", { count: active })}
        </button>
      ) : null}
    </div>
  );
}
