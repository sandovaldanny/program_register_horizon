"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { addNoteAction, deleteNoteAction, type NoteFormState } from "@/actions/notes";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import type { Note } from "@/db/schema";

export function NotesLog({ items, patientId }: { items: Note[]; patientId: string }) {
  const t = useTranslations("detail.notes");
  const tc = useTranslations("common");
  const tKind = useTranslations("enums.noteKind");
  const fmt = useFormatter();
  const [state, action, pending] = useActionState<NoteFormState, FormData>(addNoteAction, { errors: {} });
  const formRef = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.savedAt, state.ok]);

  return (
    <div className="flex flex-col gap-6">
      <form ref={formRef} action={action} className="grid grid-cols-2 gap-4 rounded-card border border-border bg-surface-soft/40 p-4 md:grid-cols-6">
        <input type="hidden" name="patientId" value={patientId} />
        <Field label={t("kind")} htmlFor="n-kind">
          <Select id="n-kind" name="kind" defaultValue="note">
            <option value="note">{tKind("note")}</option>
            <option value="action">{tKind("action")}</option>
            <option value="mdt">{tKind("mdt")}</option>
          </Select>
        </Field>
        <Field label={t("date")} htmlFor="n-date">
          <Input id="n-date" name="occurredAt" type="date" defaultValue={today} max={today} required className="ltr-data" />
        </Field>
        <Field label={t("body")} htmlFor="n-body" className="col-span-2 md:col-span-3">
          <Textarea id="n-body" name="body" required maxLength={8000} rows={2} className="min-h-[42px]" />
        </Field>
        <div className="col-span-2 flex items-end md:col-span-1">
          <Button type="submit" disabled={pending} className="w-full">
            {t("add")}
          </Button>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-bluegray">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((n) => (
            <li key={n.id} className="flex gap-4 rounded-card border border-border bg-surface p-4">
              <div className="w-28 shrink-0">
                <div className="ltr-data text-xs font-semibold text-indigo">{fmt.dateTime(new Date(`${n.occurredAt}T00:00:00`), { day: "2-digit", month: "short", year: "numeric" })}</div>
                <Badge tone={n.kind === "mdt" ? "info" : n.kind === "action" ? "warn" : n.kind === "import" ? "neutral" : "ok"} className="mt-1">
                  {tKind(n.kind)}
                </Badge>
              </div>
              <p className="flex-1 whitespace-pre-wrap text-sm leading-relaxed text-indigo">{n.body}</p>
              {n.kind !== "import" ? (
                <form action={() => deleteNoteAction(n.id, patientId)}>
                  <Button type="submit" size="sm" variant="ghost" className="text-danger">
                    {tc("delete")}
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
