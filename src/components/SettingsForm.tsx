"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateSettingsAction, type SettingsFormState } from "@/actions/settings";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import type { Settings } from "@/db/schema";

export function SettingsForm({ settings }: { settings: Settings }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(updateSettingsAction, { errors: {} });

  const num = (name: keyof Settings, label: string, min: number, max: number) => (
    <Field label={label} htmlFor={`s-${name}`} hint={state.errors[name] ? `${min}–${max}` : undefined}>
      <Input id={`s-${name}`} name={name} type="number" min={min} max={max} step={1} defaultValue={String(settings[name])} required className="ltr-data" />
    </Field>
  );

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-6">
      <section className="rounded-card border border-border bg-surface p-6 shadow-card">
        <h2 className="text-base font-semibold text-indigo">{t("thresholds.title")}</h2>
        <p className="mb-5 mt-1 text-sm text-bluegray">{t("thresholds.hint")}</p>
        <div className="grid gap-5 md:grid-cols-2">
          {num("phqChangeThreshold", t("thresholds.phq"), 1, 27)}
          {num("gadChangeThreshold", t("thresholds.gad"), 1, 21)}
        </div>
      </section>
      <section className="rounded-card border border-border bg-surface p-6 shadow-card">
        <h2 className="mb-5 text-base font-semibold text-indigo">{t("cadence.title")}</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {num("checkIntervalMonths", t("cadence.interval"), 1, 12)}
          {num("dueSoonDays", t("cadence.dueSoon"), 0, 60)}
          {num("confirmActiveDays", t("cadence.confirmActive"), 1, 365)}
          {num("attendanceConcernDays", t("cadence.attendance"), 1, 365)}
        </div>
      </section>
      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? tc("saving") : tc("save")}
        </Button>
        {state.ok ? <span className="text-sm text-turquoise-dark">{t("saved")}</span> : null}
      </div>
    </form>
  );
}
