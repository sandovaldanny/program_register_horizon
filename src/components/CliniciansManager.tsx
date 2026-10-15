"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  addClinicianAction,
  deleteClinicianAction,
  toggleClinicianAction,
  updateClinicianAction,
  type ClinicianFormState,
} from "@/actions/clinicians";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import type { Clinician } from "@/db/schema";
import { CENTER_LABELS } from "@/lib/scope";
import { cn } from "@/lib/cn";

const SPECIALTIES = ["psychiatrist", "psychologist", "other"] as const;

export function CliniciansManager({ items }: { items: Clinician[] }) {
  const t = useTranslations("settings.clinicians");
  const tc = useTranslations("common");
  const tEnum = useTranslations("enums");
  const [state, action, pending] = useActionState<ClinicianFormState, FormData>(addClinicianAction, { errors: {} });
  const [editing, setEditing] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.savedAt, state.ok]);

  const grouped = SPECIALTIES.map((sp) => ({ sp, list: items.filter((c) => c.specialty === sp) })).filter((g) => g.list.length);

  return (
    <div className="flex flex-col gap-6">
      <form ref={formRef} action={action} className="grid grid-cols-2 gap-4 rounded-card border border-border bg-surface-soft/40 p-4 md:grid-cols-5">
        <Field label={t("name")} htmlFor="c-name" hint={state.errors.name ? t(`errors.${state.errors.name === "duplicate" ? "duplicate" : "invalid"}`) : undefined} className="col-span-2">
          <Input id="c-name" name="name" required placeholder={t("namePlaceholder")} className={cn(state.errors.name && "border-danger")} />
        </Field>
        <Field label={t("specialty")} htmlFor="c-specialty">
          <Select id="c-specialty" name="specialty" defaultValue="psychiatrist">
            {SPECIALTIES.map((s) => (
              <option key={s} value={s}>
                {tEnum(`specialty.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("center")} htmlFor="c-center">
          <Select id="c-center" name="center" defaultValue="">
            <option value="">{t("bothCenters")}</option>
            {(["al_falah", "al_bateen"] as const).map((c) => (
              <option key={c} value={c}>
                {CENTER_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="col-span-2 flex items-end md:col-span-1">
          <Button type="submit" disabled={pending} className="w-full">
            {t("add")}
          </Button>
        </div>
      </form>

      {grouped.map(({ sp, list }) => (
        <div key={sp}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-bluegray">
            {tEnum(`specialty.${sp}`)} · {list.length}
          </h3>
          <ul className="divide-y divide-border/60 rounded-card border border-border bg-surface">
            {list.map((c) =>
              editing === c.id ? (
                <EditRow key={c.id} item={c} onDone={() => setEditing(null)} />
              ) : (
                <li key={c.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm", !c.active && "opacity-50")}>
                  <span className="min-w-40 font-medium text-indigo">{c.name}</span>
                  <Badge tone="neutral">{c.center ? CENTER_LABELS[c.center] : t("bothCenters")}</Badge>
                  {!c.active ? <Badge tone="warn">{t("inactive")}</Badge> : null}
                  <span className="ms-auto inline-flex gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(c.id)}>
                      {tc("edit")}
                    </Button>
                    <form action={() => toggleClinicianAction(c.id, !c.active)}>
                      <Button type="submit" size="sm" variant="ghost">
                        {c.active ? t("deactivate") : t("activate")}
                      </Button>
                    </form>
                    <form
                      action={() => deleteClinicianAction(c.id)}
                      onSubmit={(e) => {
                        if (!window.confirm(t("confirmDelete", { name: c.name }))) e.preventDefault();
                      }}
                    >
                      <Button type="submit" size="sm" variant="ghost" className="text-danger">
                        {tc("delete")}
                      </Button>
                    </form>
                  </span>
                </li>
              ),
            )}
          </ul>
        </div>
      ))}
      {items.length === 0 ? <p className="text-sm text-bluegray">{t("empty")}</p> : null}
    </div>
  );
}

function EditRow({ item, onDone }: { item: Clinician; onDone: () => void }) {
  const t = useTranslations("settings.clinicians");
  const tc = useTranslations("common");
  const tEnum = useTranslations("enums");
  const bound = updateClinicianAction.bind(null, item.id);
  const [state, action, pending] = useActionState<ClinicianFormState, FormData>(
    async (prev, fd) => {
      const next = await bound(prev, fd);
      if (next.ok) onDone();
      return next;
    },
    { errors: {} },
  );
  return (
    <li className="bg-surface-soft/40 px-4 py-3">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <Input name="name" defaultValue={item.name} required className={cn("w-56", state.errors.name && "border-danger")} aria-label={t("name")} />
        <Select name="specialty" defaultValue={item.specialty} className="w-44" aria-label={t("specialty")}>
          {SPECIALTIES.map((s) => (
            <option key={s} value={s}>
              {tEnum(`specialty.${s}`)}
            </option>
          ))}
        </Select>
        <Select name="center" defaultValue={item.center ?? ""} className="w-44" aria-label={t("center")}>
          <option value="">{t("bothCenters")}</option>
          {(["al_falah", "al_bateen"] as const).map((c) => (
            <option key={c} value={c}>
              {CENTER_LABELS[c]}
            </option>
          ))}
        </Select>
        <Button type="submit" size="sm" disabled={pending}>
          {tc("save")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {tc("cancel")}
        </Button>
      </form>
    </li>
  );
}
