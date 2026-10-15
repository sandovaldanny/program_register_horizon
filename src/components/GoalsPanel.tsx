"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, RotateCcw, Target, Trash2, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { addGoalAction, deleteGoalAction, setGoalStatusAction, updateGoalAction, type GoalFormState } from "@/actions/goals";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import type { Goal } from "@/db/schema";
import { cn } from "@/lib/cn";

export function GoalsPanel({ items, patientId, categories }: { items: Goal[]; patientId: string; categories: string[] }) {
  const t = useTranslations("goals");
  const tc = useTranslations("common");
  const fmt = useFormatter();
  const [state, action, pending] = useActionState<GoalFormState, FormData>(addGoalAction, { errors: {} });
  const [editing, setEditing] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.savedAt, state.ok]);

  const date = (iso: string | null) => (iso ? fmt.dateTime(new Date(`${iso}T00:00:00`), { day: "2-digit", month: "short", year: "numeric" }) : null);
  const open = items.filter((g) => g.status === "open");
  const closed = items.filter((g) => g.status !== "open");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-5">
      <form ref={formRef} action={action} className="grid grid-cols-2 gap-3 rounded-card border border-border bg-surface-soft/40 p-4 md:grid-cols-6">
        <input type="hidden" name="patientId" value={patientId} />
        <Field label={t("titleLabel")} htmlFor="g-title" className="col-span-2 md:col-span-3" hint={state.errors.title ? t("titleError") : undefined}>
          <Input id="g-title" name="title" required maxLength={200} placeholder={t("titlePlaceholder")} className={cn(state.errors.title && "border-danger")} />
        </Field>
        <Field label={t("category")} htmlFor="g-cat" className="md:col-span-2">
          <Select id="g-cat" name="category" defaultValue="">
            <option value="">{t("noCategory")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("targetDate")} htmlFor="g-date">
          <Input id="g-date" name="targetDate" type="date" className="ltr-data" />
        </Field>
        <Field label={t("notes")} htmlFor="g-notes" className="col-span-2 md:col-span-5">
          <Textarea id="g-notes" name="notes" rows={1} maxLength={2000} className="min-h-[42px]" />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={pending} className="w-full">
            {t("add")}
          </Button>
        </div>
      </form>

      {items.length === 0 ? <p className="text-sm text-bluegray">{t("empty")}</p> : null}

      {open.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {open.map((g) =>
            editing === g.id ? (
              <EditGoal key={g.id} goal={g} categories={categories} onDone={() => setEditing(null)} />
            ) : (
              <li key={g.id} className="flex items-start gap-3 rounded-card border border-border bg-surface p-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-turquoise/20 text-turquoise-dark">
                  <Target className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-indigo">{g.title}</span>
                    {g.category ? <Badge tone="info">{g.category}</Badge> : null}
                    {g.targetDate ? (
                      <Badge tone={g.targetDate < today ? "warn" : "neutral"}>
                        {t("due", { date: date(g.targetDate) ?? "" })}
                      </Badge>
                    ) : null}
                  </div>
                  {g.notes ? <p className="mt-1 whitespace-pre-wrap text-sm text-bluegray">{g.notes}</p> : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <form action={() => setGoalStatusAction(g.id, patientId, "achieved")}>
                    <Button type="submit" size="sm" variant="ghost" title={t("markAchieved")} className="text-turquoise-dark">
                      <Check className="h-4 w-4" aria-hidden /> {t("achieved")}
                    </Button>
                  </form>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(g.id)}>
                    {tc("edit")}
                  </Button>
                  <form action={() => setGoalStatusAction(g.id, patientId, "dropped")}>
                    <Button type="submit" size="sm" variant="ghost" title={t("markDropped")} className="text-bluegray">
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </form>
                </div>
              </li>
            ),
          )}
        </ul>
      ) : null}

      {closed.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-bluegray">
            {t("closedCount", { count: closed.length })}
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {closed.map((g) => (
              <li key={g.id} className="flex items-start gap-3 rounded-card border border-border/60 bg-surface-soft/30 p-3 text-sm">
                <Badge tone={g.status === "achieved" ? "ok" : "neutral"}>{t(g.status)}</Badge>
                <div className="min-w-0 flex-1">
                  <span className={cn("text-indigo", g.status === "dropped" && "line-through opacity-70")}>{g.title}</span>
                  {g.achievedAt ? <span className="ms-2 text-xs text-bluegray">{date(g.achievedAt)}</span> : null}
                </div>
                <form action={() => setGoalStatusAction(g.id, patientId, "open")}>
                  <Button type="submit" size="sm" variant="ghost" title={t("reopen")}>
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </form>
                <form
                  action={() => deleteGoalAction(g.id, patientId)}
                  onSubmit={(e) => {
                    if (!window.confirm(t("confirmDelete"))) e.preventDefault();
                  }}
                >
                  <Button type="submit" size="sm" variant="ghost" className="text-danger" title={tc("delete")}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function EditGoal({ goal, categories, onDone }: { goal: Goal; categories: string[]; onDone: () => void }) {
  const t = useTranslations("goals");
  const tc = useTranslations("common");
  const bound = updateGoalAction.bind(null, goal.id);
  const [, action, pending] = useActionState<GoalFormState, FormData>(
    async (prev, fd) => {
      const next = await bound(prev, fd);
      if (next.ok) onDone();
      return next;
    },
    { errors: {} },
  );
  return (
    <li className="rounded-card border border-border bg-surface-soft/40 p-4">
      <form action={action} className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <input type="hidden" name="patientId" value={goal.patientId} />
        <Input name="title" defaultValue={goal.title} required maxLength={200} className="col-span-2 md:col-span-3" aria-label={t("titleLabel")} />
        <Select name="category" defaultValue={goal.category ?? ""} className="md:col-span-2" aria-label={t("category")}>
          <option value="">{t("noCategory")}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input name="targetDate" type="date" defaultValue={goal.targetDate ?? ""} className="ltr-data" aria-label={t("targetDate")} />
        <Textarea name="notes" defaultValue={goal.notes ?? ""} rows={1} className="col-span-2 min-h-[42px] md:col-span-4" aria-label={t("notes")} />
        <div className="col-span-2 flex gap-2 md:col-span-2">
          <Button type="submit" size="sm" disabled={pending}>
            {tc("save")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            {tc("cancel")}
          </Button>
        </div>
      </form>
    </li>
  );
}
