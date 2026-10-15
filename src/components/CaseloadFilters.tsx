"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Field, Input, Select } from "@/components/ui/Field";
import { ALERT_FILTERS, type CaseloadFilters as Filters } from "@/lib/filters";

const SEVERITIES = ["severe", "moderately_severe", "moderate", "mild", "minimal"] as const;
const GAD_SEVERITIES = ["severe", "moderate", "mild", "minimal"] as const;
const TRENDS = ["worsening", "mixed", "stable", "improving", "first_score"] as const;
const PRIORITIES = ["high", "mid", "low", "routine"] as const;
const STATUSES = ["active", "inactive", "graduated", "transferred", "all"] as const;
const SORTS = ["priority", "severity", "last_score", "mrn"] as const;

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

  const active = Object.entries(filters).filter(([k, v]) => v && !(k === "status" && v === "active") && !(k === "sort" && v === "priority")).length;

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card" aria-busy={pending}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-9">
        <Field label={t("search")} htmlFor="f-q" className="col-span-2">
          <Input id="f-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} />
        </Field>
        <Field label={t("alert")} htmlFor="f-alert">
          <Select id="f-alert" value={filters.alert} onChange={(e) => set("alert", e.target.value)}>
            <option value="">{t("any")}</option>
            {ALERT_FILTERS.map((a) => (
              <option key={a} value={a}>
                {a === "needs_attention" ? t("needsAttention") : tFlags(a)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("phqSeverity")} htmlFor="f-phq">
          <Select id="f-phq" value={filters.phqSeverity} onChange={(e) => set("phq", e.target.value)}>
            <option value="">{t("any")}</option>
            {SEVERITIES.map((v) => (
              <option key={v} value={v}>
                {tEnum(`severity.${v}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("gadSeverity")} htmlFor="f-gad">
          <Select id="f-gad" value={filters.gadSeverity} onChange={(e) => set("gad", e.target.value)}>
            <option value="">{t("any")}</option>
            {GAD_SEVERITIES.map((v) => (
              <option key={v} value={v}>
                {tEnum(`severity.${v}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("trend")} htmlFor="f-trend">
          <Select id="f-trend" value={filters.trend} onChange={(e) => set("trend", e.target.value)}>
            <option value="">{t("any")}</option>
            {TRENDS.map((v) => (
              <option key={v} value={v}>
                {tEnum(`trend.${v}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("clinician")} htmlFor="f-clinician">
          <Select id="f-clinician" value={filters.clinician} onChange={(e) => set("clinician", e.target.value)}>
            <option value="">{t("any")}</option>
            {clinicians.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("priority")} htmlFor="f-priority">
          <Select id="f-priority" value={filters.priority} onChange={(e) => set("priority", e.target.value)}>
            <option value="">{t("any")}</option>
            {PRIORITIES.map((v) => (
              <option key={v} value={v}>
                {tEnum(`priority.${v}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("status")} htmlFor="f-status">
          <Select id="f-status" value={filters.status} onChange={(e) => set("status", e.target.value === "active" ? "" : e.target.value)}>
            {STATUSES.map((v) => (
              <option key={v} value={v}>
                {v === "all" ? t("allStatuses") : tEnum(`status.${v}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <label htmlFor="f-sort" className="text-xs font-semibold uppercase tracking-wide text-bluegray">
            {t("sort")}
          </label>
          <Select id="f-sort" value={filters.sort} onChange={(e) => set("sort", e.target.value === "priority" ? "" : e.target.value)} className="w-auto py-1.5">
            {SORTS.map((v) => (
              <option key={v} value={v}>
                {t(`sortBy.${v}`)}
              </option>
            ))}
          </Select>
        </div>
        {active > 0 ? (
          <button type="button" onClick={() => start(() => router.replace(pathname))} className="font-medium text-steel hover:underline">
            {t("clear", { count: active })}
          </button>
        ) : null}
      </div>
    </div>
  );
}
