"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Multi-select chips from a catalogue (clinicians, diagnoses, care plan).
 * Submits one comma-separated value under `name`. Catalogue-only: items are
 * managed in Settings, so there is no free-text fallback here.
 */
export function ClinicianPicker({
  name,
  label,
  options,
  initial,
  emptyText,
}: {
  name: string;
  label: string;
  options: string[];
  initial: string[];
  emptyText: string;
}) {
  const [selected, setSelected] = useState<string[]>(initial.filter((n) => options.includes(n)));
  const toggle = (n: string) => setSelected((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  const dropped = initial.filter((n) => !options.includes(n));

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-bluegray">{label}</span>
      <input type="hidden" name={name} value={selected.join(", ")} />
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
        {options.length === 0 ? <span className="text-xs text-bluegray">{emptyText}</span> : null}
      </div>
      {dropped.length > 0 ? (
        <p className="text-xs text-amber" title={dropped.join(", ")}>
          ⚠ {dropped.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
