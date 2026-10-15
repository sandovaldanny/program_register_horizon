"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createPatientAction, updatePatientAction, type PatientFormState } from "@/actions/patients";
import { ClinicianPicker } from "@/components/ClinicianPicker";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import type { CatalogItem, Clinician, Patient } from "@/db/schema";
import { matchLabels, normalizeCarePlan, splitLabels } from "@/lib/diagnosis";
import { catalogNames } from "@/db/queries-shared";
import { splitNames } from "@/lib/import/normalize";
import { CENTER_LABELS } from "@/lib/scope";
import { REASONS_NOT_ATTENDING } from "@/lib/validation";
import { cn } from "@/lib/cn";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface p-6 shadow-card">
      <h2 className="mb-5 text-base font-semibold text-indigo">{title}</h2>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">{children}</div>
    </section>
  );
}

export function PatientForm({
  patient,
  defaultCenter,
  clinicians,
  diagnoses,
  carePlans,
}: {
  patient?: Patient;
  defaultCenter?: "al_falah" | "al_bateen";
  clinicians: Clinician[];
  diagnoses: CatalogItem[];
  carePlans: CatalogItem[];
}) {
  const diagnosisOptions = diagnoses.filter((d) => d.active).map((d) => d.label);
  const carePlanOptions = carePlans.filter((d) => d.active).map((d) => d.label);
  const t = useTranslations("form");
  const tEnum = useTranslations("enums");
  const tc = useTranslations("common");
  const action = patient ? updatePatientAction.bind(null, patient.id) : createPatientAction;
  const [state, formAction, pending] = useActionState<PatientFormState, FormData>(action, { errors: {} });
  const err = (k: string) => state.errors[k];
  const errCls = (k: string) => (err(k) ? "border-danger" : "");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Section title={t("sections.identity")}>
        <Field label={t("center")} htmlFor="p-center">
          <Select id="p-center" name="center" defaultValue={patient?.center ?? defaultCenter ?? "al_falah"}>
            {(["al_falah", "al_bateen"] as const).map((c) => (
              <option key={c} value={c}>
                {CENTER_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("mrn")} htmlFor="p-mrn" hint={err("mrn") ? t(`errors.${err("mrn")}`) : undefined}>
          <Input id="p-mrn" name="mrn" defaultValue={patient?.mrn ?? ""} required className={cn("ltr-data", errCls("mrn"))} />
        </Field>
        <Field label={t("displayName")} htmlFor="p-name">
          <Input id="p-name" name="displayName" defaultValue={patient?.displayName ?? ""} />
        </Field>
        <Field label={t("age")} htmlFor="p-age">
          <Input id="p-age" name="age" type="number" min={0} max={120} defaultValue={patient?.age ?? ""} className={cn("ltr-data", errCls("age"))} />
        </Field>
        <Field label={t("gender")} htmlFor="p-gender">
          <Select id="p-gender" name="gender" defaultValue={patient?.gender ?? "unknown"}>
            {(["unknown", "female", "male"] as const).map((g) => (
              <option key={g} value={g}>
                {tEnum(`gender.${g}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("status")} htmlFor="p-status">
          <Select id="p-status" name="status" defaultValue={patient?.status ?? "active"}>
            {(["active", "inactive"] as const).map((s) => (
              <option key={s} value={s}>
                {tEnum(`status.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title={t("sections.care")}>
        <div className="md:col-span-3">
          <ClinicianPicker
            name="diagnosis"
            label={t("diagnosis")}
            options={diagnosisOptions}
            initial={matchLabels(splitLabels(patient?.diagnosis), diagnosisOptions)}
            emptyText={t("noDiagnoses")}
          />
        </div>
        <div className="md:col-span-3">
          <ClinicianPicker
            name="carePlan"
            label={t("carePlan")}
            options={carePlanOptions}
            initial={matchLabels(normalizeCarePlan(patient?.carePlan), carePlanOptions)}
            emptyText={t("noCarePlans")}
          />
        </div>
        <div className="md:col-span-3 grid gap-5 md:grid-cols-2">
          <ClinicianPicker name="psychiatrist" label={t("psychiatrist")} options={catalogNames(clinicians, "psychiatrist")} initial={splitNames(patient?.psychiatrist ?? null)} emptyText={t("noClinicians")} />
          <ClinicianPicker name="psychologist" label={t("psychologist")} options={catalogNames(clinicians, "psychologist")} initial={splitNames(patient?.psychologist ?? null)} emptyText={t("noClinicians")} />
        </div>
        <Field label={t("isHorizonPatient")} htmlFor="p-horizon">
          <Select id="p-horizon" name="isHorizonPatient" defaultValue={patient?.isHorizonPatient === null || patient?.isHorizonPatient === undefined ? "" : patient.isHorizonPatient ? "yes" : "no"}>
            <option value="">{tc("unknown")}</option>
            <option value="yes">{tc("yes")}</option>
            <option value="no">{tc("no")}</option>
          </Select>
        </Field>
        <Field label={t("medication")} htmlFor="p-med">
          <Select id="p-med" name="medication" defaultValue={patient?.medication ?? "unknown"}>
            {(["unknown", "yes", "no"] as const).map((m) => (
              <option key={m} value={m}>
                {tEnum(`medication.${m}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("medicationAdherence")} htmlFor="p-adh" className="md:col-span-2">
          <Input id="p-adh" name="medicationAdherence" defaultValue={patient?.medicationAdherence ?? ""} />
        </Field>
        <Field label={t("therapyProgress")} htmlFor="p-prog" className="md:col-span-3">
          <Textarea id="p-prog" name="therapyProgress" defaultValue={patient?.therapyProgress ?? ""} rows={2} />
        </Field>
        <Field label={t("treatmentGoals")} htmlFor="p-goals" className="md:col-span-3">
          <Textarea id="p-goals" name="treatmentGoals" defaultValue={patient?.treatmentGoals ?? ""} rows={2} />
        </Field>
      </Section>

      <Section title={t("sections.attendance")}>
        <Field label={t("lastSessionDate")} htmlFor="p-last">
          <Input id="p-last" name="lastSessionDate" type="date" max={today} defaultValue={patient?.lastSessionDate ?? ""} className={cn("ltr-data", errCls("lastSessionDate"))} />
        </Field>
        <Field label={t("sessionsCount")} htmlFor="p-sessions">
          <Input id="p-sessions" name="sessionsCount" type="number" min={0} defaultValue={patient?.sessionsCount ?? ""} className="ltr-data" />
        </Field>
        <Field label={t("attendancePct")} htmlFor="p-pct">
          <Input id="p-pct" name="attendancePct" type="number" min={0} max={100} step="0.01" defaultValue={patient?.attendancePct ?? ""} className="ltr-data" />
        </Field>
        <Field label={t("attendancePattern")} htmlFor="p-pattern">
          <Select id="p-pattern" name="attendancePattern" defaultValue={patient?.attendancePattern ?? ""}>
            <option value="">{tc("unknown")}</option>
            {(["consistent", "irregular", "not_attending", "too_early"] as const).map((p) => (
              <option key={p} value={p}>
                {tEnum(`attendancePattern.${p}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("reasonNotAttending")} htmlFor="p-reason" className="md:col-span-2">
          <Input id="p-reason" name="reasonNotAttending" list="reasons" defaultValue={patient?.reasonNotAttending ?? ""} />
          <datalist id="reasons">
            {REASONS_NOT_ATTENDING.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
      </Section>

      <Section title={t("sections.followUp")}>
        <Field label={t("followUpPriority")} htmlFor="p-priority">
          <Select id="p-priority" name="followUpPriority" defaultValue={patient?.followUpPriority ?? "routine"}>
            {(["routine", "low", "mid", "high"] as const).map((p) => (
              <option key={p} value={p}>
                {tEnum(`priority.${p}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("ccAction")} htmlFor="p-cc">
          <Input id="p-cc" name="ccAction" defaultValue={patient?.ccAction ?? ""} />
        </Field>
        <Field label={t("outcome")} htmlFor="p-outcome">
          <Input id="p-outcome" name="outcome" defaultValue={patient?.outcome ?? ""} />
        </Field>
      </Section>

      {Object.keys(state.errors).length > 0 && !err("mrn") ? <p className="text-sm text-danger">{t("errors.invalid")}</p> : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tc("saving") : patient ? t("update") : t("create")}
        </Button>
      </div>
    </form>
  );
}
