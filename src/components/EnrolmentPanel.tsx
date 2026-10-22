"use client";

import { useActionState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { reenrollPatientAction, unenrollPatientAction, type UnenrollFormState } from "@/actions/patients";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import type { Patient } from "@/db/schema";
import { cn } from "@/lib/cn";

/** Enrolment card on the patient page: enrolled since / unenrolled on + reason, with unenrol / re-enrol actions. */
export function EnrolmentPanel({ patient, reasons }: { patient: Patient; reasons: string[] }) {
  const t = useTranslations("detail.enrolment");
  const tEnum = useTranslations("enums");
  const tForm = useTranslations("form");
  const fmt = useFormatter();
  const bound = unenrollPatientAction.bind(null, patient.id);
  const [state, action, pending] = useActionState<UnenrollFormState, FormData>(bound, { errors: {} });
  const date = (iso: string | null) => (iso ? fmt.dateTime(new Date(`${iso}T00:00:00`), { day: "2-digit", month: "short", year: "numeric" }) : "—");
  const today = new Date().toISOString().slice(0, 10);
  const enrolled = patient.status === "active";

  return (
    <div className={cn("rounded-card border bg-surface p-6 shadow-card", enrolled ? "border-border" : "border-amber/50")}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-indigo">{t("title")}</h2>
        <Badge tone={enrolled ? "ok" : "warn"}>{tEnum(`status.${enrolled ? "active" : "inactive"}`)}</Badge>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-bluegray">{t("enrolledOn")}</dt>
          <dd className="ltr-data mt-0.5 text-sm text-indigo">{date(patient.enrolledAt)}</dd>
        </div>
        {!enrolled ? (
          <>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-bluegray">{t("unenrolledOn")}</dt>
              <dd className="ltr-data mt-0.5 text-sm text-indigo">{date(patient.unenrolledAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-bluegray">{t("reason")}</dt>
              <dd className="mt-0.5 text-sm text-indigo">{patient.unenrollReason || "—"}</dd>
            </div>
          </>
        ) : null}
      </dl>

      {enrolled ? (
        <details className="group mt-5 border-t border-border pt-4">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-steel hover:underline">
            <LogOut className="h-4 w-4" aria-hidden /> {t("unenrol")}
          </summary>
          <form action={action} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={tForm("unenrolledAt")} htmlFor="un-date" hint={state.errors.unenrolledAt ? tForm(`errors.${state.errors.unenrolledAt}`) : undefined}>
              <Input id="un-date" name="unenrolledAt" type="date" required max={today} min={patient.enrolledAt} defaultValue={today} className={cn("ltr-data", state.errors.unenrolledAt && "border-danger")} />
            </Field>
            <Field label={tForm("unenrollReason")} htmlFor="un-reason" hint={state.errors.unenrollReason ? tForm(`errors.${state.errors.unenrollReason}`) : reasons.length === 0 ? tForm("noUnenrollReasons") : undefined}>
              <Select id="un-reason" name="unenrollReason" required defaultValue="" className={cn(state.errors.unenrollReason && "border-danger")}>
                <option value="">{tForm("chooseReason")}</option>
                {reasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-xs text-bluegray sm:col-span-2">{t("unenrolHint")}</p>
            <div className="sm:col-span-2">
              <Button type="submit" size="sm" variant="danger" disabled={pending || reasons.length === 0}>
                {t("confirmUnenrol")}
              </Button>
            </div>
          </form>
        </details>
      ) : (
        <form
          action={() => reenrollPatientAction(patient.id)}
          onSubmit={(e) => {
            if (!window.confirm(t("confirmReenrol"))) e.preventDefault();
          }}
          className="mt-5 border-t border-border pt-4"
        >
          <Button type="submit" size="sm" variant="secondary">
            <LogIn className="h-4 w-4" aria-hidden /> {t("reenrol")}
          </Button>
          <p className="mt-2 text-xs text-bluegray">{t("reenrolHint")}</p>
        </form>
      )}
    </div>
  );
}
