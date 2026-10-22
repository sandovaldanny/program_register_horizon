"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { updateAttendanceAction, type AttendanceFormState } from "@/actions/patients";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import type { Patient } from "@/db/schema";
import { REASONS_NOT_ATTENDING } from "@/lib/validation";
import { cn } from "@/lib/cn";

const PATTERNS = ["consistent", "irregular", "not_attending", "too_early"] as const;

/** Attendance card on the patient page: sessions by specialty up top, inline edit form. */
export function AttendancePanel({ patient }: { patient: Patient }) {
  const t = useTranslations("detail.attendance");
  const tForm = useTranslations("form");
  const tEnum = useTranslations("enums");
  const tc = useTranslations("common");
  const fmt = useFormatter();
  const [editing, setEditing] = useState(false);
  const bound = updateAttendanceAction.bind(null, patient.id);
  const [state, action, pending] = useActionState<AttendanceFormState, FormData>(
    async (prev, fd) => {
      const next = await bound(prev, fd);
      if (next.ok) setEditing(false);
      return next;
    },
    { errors: {} },
  );
  const today = new Date().toISOString().slice(0, 10);
  const date = (iso: string | null) => (iso ? fmt.dateTime(new Date(`${iso}T00:00:00`), { day: "2-digit", month: "short", year: "numeric" }) : "—");

  const err = (k: string) => (state.errors[k] ? tForm(`errors.${state.errors[k]}`) : undefined);

  return (
    <div className="rounded-card border border-border bg-surface p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-indigo">{t("title")}</h2>
        {!editing ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" aria-hidden /> {tc("edit")}
          </Button>
        ) : null}
      </div>

      {!editing ? (
        <>
          <div className="flex flex-wrap items-end gap-6 rounded-card bg-surface-soft/60 px-4 py-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-bluegray">{tForm("sessionsTotal")}</div>
              <div className="ltr-data mt-0.5 text-2xl font-medium text-indigo">{patient.sessionsCount ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-bluegray">{tForm("psychologySessions")}</div>
              <div className="ltr-data mt-0.5 text-lg font-medium text-turquoise-dark">{patient.psychologySessions ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-bluegray">{tForm("psychiatrySessions")}</div>
              <div className="ltr-data mt-0.5 text-lg font-medium text-steel">{patient.psychiatrySessions ?? "—"}</div>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Info label={tForm("lastSessionDate")} value={date(patient.lastSessionDate)} ltr />
            <Info label={tForm("attendancePattern")} value={patient.attendancePattern ? tEnum(`attendancePattern.${patient.attendancePattern}`) : null} />
            <div className="sm:col-span-2">
              <Info label={tForm("reasonNotAttending")} value={patient.reasonNotAttending} />
            </div>
          </dl>
        </>
      ) : (
        <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={tForm("psychologySessions")} htmlFor="att-psy" hint={err("psychologySessions")}>
            <Input id="att-psy" name="psychologySessions" type="number" min={0} defaultValue={patient.psychologySessions ?? ""} className="ltr-data" />
          </Field>
          <Field label={tForm("psychiatrySessions")} htmlFor="att-psych" hint={err("psychiatrySessions")}>
            <Input id="att-psych" name="psychiatrySessions" type="number" min={0} defaultValue={patient.psychiatrySessions ?? ""} className="ltr-data" />
          </Field>
          <Field label={tForm("lastSessionDate")} htmlFor="att-last" hint={err("lastSessionDate")}>
            <Input id="att-last" name="lastSessionDate" type="date" max={today} defaultValue={patient.lastSessionDate ?? ""} className={cn("ltr-data", state.errors.lastSessionDate && "border-danger")} />
          </Field>
          <Field label={tForm("attendancePattern")} htmlFor="att-pattern">
            <Select id="att-pattern" name="attendancePattern" defaultValue={patient.attendancePattern ?? ""}>
              <option value="">{tc("unknown")}</option>
              {PATTERNS.map((p) => (
                <option key={p} value={p}>
                  {tEnum(`attendancePattern.${p}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tForm("reasonNotAttending")} htmlFor="att-reason" className="sm:col-span-2">
            <Input id="att-reason" name="reasonNotAttending" list="att-reasons" defaultValue={patient.reasonNotAttending ?? ""} />
            <datalist id="att-reasons">
              {REASONS_NOT_ATTENDING.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
          <p className="text-xs text-bluegray sm:col-span-2">{t("totalHint")}</p>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? tc("saving") : tc("save")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {tc("cancel")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Info({ label, value, ltr }: { label: string; value?: string | null; ltr?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-bluegray">{label}</dt>
      <dd className={cn("mt-0.5 text-sm text-indigo", ltr && "ltr-data")}>{value || "—"}</dd>
    </div>
  );
}
