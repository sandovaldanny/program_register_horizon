"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { addAssessmentAction, type AssessmentFormState } from "@/actions/assessments";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { SCALE_MAX } from "@/lib/metrics/severity";

const today = () => new Date().toISOString().slice(0, 10);

export function QuickAddScoreForm({ patientId }: { patientId: string }) {
  const t = useTranslations("detail.addScore");
  const tErr = useTranslations("form.errors");
  const tScale = useTranslations("enums.scale");
  const [state, action, pending] = useActionState<AssessmentFormState, FormData>(addAssessmentAction, { errors: {} });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.savedAt, state.ok]);

  return (
    <form ref={formRef} action={action} className="grid grid-cols-2 gap-4 md:grid-cols-5">
      <input type="hidden" name="patientId" value={patientId} />
      <Field label={t("scale")} htmlFor="qa-scale">
        <Select id="qa-scale" name="scale" defaultValue="phq9">
          <option value="phq9">{tScale("phq9")}</option>
          <option value="gad7">{tScale("gad7")}</option>
        </Select>
      </Field>
      <Field label={t("score")} htmlFor="qa-score" hint={state.errors.score ? tErr("scoreRange", { max: SCALE_MAX.phq9 }) : t("range", { max: 27 })}>
        <Input id="qa-score" name="score" type="number" inputMode="numeric" min={0} max={27} step={1} required className="ltr-data" />
      </Field>
      <Field label={t("date")} htmlFor="qa-date" hint={state.errors.assessedAt ? tErr(state.errors.assessedAt === "dateFuture" ? "dateFuture" : "dateRequired") : undefined}>
        <Input id="qa-date" name="assessedAt" type="date" defaultValue={today()} max={today()} required className="ltr-data" />
      </Field>
      <Field label={t("note")} htmlFor="qa-note" className="col-span-2 md:col-span-1">
        <Input id="qa-note" name="note" maxLength={500} />
      </Field>
      <div className="col-span-2 flex items-end md:col-span-1">
        <Button type="submit" disabled={pending} className="w-full">
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
