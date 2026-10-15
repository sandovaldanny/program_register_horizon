"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

/**
 * Multi-select chips from the clinicians catalogue plus a free-text "other"
 * box for names not yet in the catalogue. Submits one comma-separated value.
 */
export function ClinicianPicker({
  name,
  label,
  options,
  initial,
  hint,
  emptyText,
  otherText,
}: {
  name: string;
  label: string;
  options: string[];
  initial: string[];
  hint?: string;
  emptyText?: string;
  otherText?: string;
}) {
  const t = useTranslations("form");
  const empty = emptyText ?? t("noClinicians");
  const other = otherText ?? t("otherClinician");
  const [selected, setSelected] = useState<string[]>(initial.filter((n) => options.includes(n)));
  const [otherValue, setOtherValue] = useState(initial.filter((n) => !options.includes(n)).join(", "));

  const toggle = (n: string) => setSelected((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  const value = [...selected, ...otherValue.split(",").map((s) => s.trim()).filter(Boolean)].join(", ");

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-bluegray">{label}</span>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-1.5">
        {options.map((n) => {
          const on = selected.includes(n);
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(n)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                on ? "border-indigo bg-indigo text-white" : "border-border bg-surface text-indigo hover:border-turquoise",
              )}
            >
              {n}
            </button>
          );
        })}
        {options.length === 0 ? <span className="text-xs text-bluegray">{empty}</span> : null}
      </div>
      <Input value={otherValue} onChange={(e) => setOtherValue(e.target.value)} placeholder={other} className="mt-1" aria-label={other} />
      {hint ? <p className="text-xs text-bluegray">{hint}</p> : null}
    </div>
  );
}
