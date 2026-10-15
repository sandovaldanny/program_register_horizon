"use client";

import { useActionState, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { deleteAssessmentAction, updateAssessmentAction, type AssessmentFormState } from "@/actions/assessments";
import { Badge, severityTone } from "@/components/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import type { Assessment } from "@/db/schema";
import { severityFor, SCALE_MAX } from "@/lib/metrics/severity";
import { cn } from "@/lib/cn";

export function AssessmentList({ items, patientId }: { items: Assessment[]; patientId: string }) {
  const t = useTranslations("detail.assessments");
  const tc = useTranslations("common");
  const tScale = useTranslations("enums.scale");
  const tSev = useTranslations("enums.severity");
  const fmt = useFormatter();
  const [editing, setEditing] = useState<string | null>(null);

  const date = (iso: string) => fmt.dateTime(new Date(`${iso}T00:00:00`), { day: "2-digit", month: "short", year: "numeric" });
  const th = "px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-bluegray";

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-border bg-surface-soft/60">
          <tr>
            <th className={th}>{t("date")}</th>
            <th className={th}>{t("scale")}</th>
            <th className={th}>{t("score")}</th>
            <th className={th}>{t("severity")}</th>
            <th className={th}>{t("source")}</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {[...items].reverse().map((a) =>
            editing === a.id ? (
              <EditRow key={a.id} item={a} patientId={patientId} onDone={() => setEditing(null)} />
            ) : (
              <tr key={a.id} className="border-b border-border/60 last:border-0">
                <td className="ltr-data whitespace-nowrap px-4 py-2.5">
                  {date(a.assessedAt)}
                  {a.dateSource === "estimated" ? (
                    <span title={tc("estimated")} className="ms-2 text-xs text-amber">
                      ~ {tc("estimatedShort")}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 font-medium">{tScale(a.scale)}</td>
                <td className="ltr-data px-4 py-2.5 font-semibold">{a.score}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={severityTone(severityFor(a.scale, a.score))}>{tSev(severityFor(a.scale, a.score))}</Badge>
                </td>
                <td className="px-4 py-2.5 text-xs text-bluegray">
                  {a.source.replace("import_", "import · ").replace("_", " ")}
                  {a.note ? <span className="block text-bluegray/80">{a.note}</span> : null}
                </td>
                <td className="px-4 py-2.5 text-end">
                  <div className="inline-flex gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(a.id)}>
                      {tc("edit")}
                    </Button>
                    <form
                      action={() => deleteAssessmentAction(a.id)}
                      onSubmit={(e) => {
                        if (!window.confirm(t("confirmDelete"))) e.preventDefault();
                      }}
                    >
                      <Button type="submit" size="sm" variant="ghost" className="text-danger">
                        {tc("delete")}
                      </Button>
                    </form>
                  </div>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function EditRow({ item, patientId, onDone }: { item: Assessment; patientId: string; onDone: () => void }) {
  const tc = useTranslations("common");
  const tErr = useTranslations("form.errors");
  const tScale = useTranslations("enums.scale");
  const bound = updateAssessmentAction.bind(null, item.id);
  const [state, action, pending] = useActionState<AssessmentFormState, FormData>(
    async (prev, fd) => {
      const next = await bound(prev, fd);
      if (next.ok) onDone();
      return next;
    },
    { errors: {} },
  );
  const max = SCALE_MAX[item.scale];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <tr className="border-b border-border/60 bg-surface-soft/40">
      <td colSpan={6} className="px-4 py-3">
        <form action={action} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="patientId" value={patientId} />
          <input type="hidden" name="scale" value={item.scale} />
          <span className="pb-2.5 text-sm font-medium">{tScale(item.scale)}</span>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-bluegray">
            {tc("edit")} · date
            <Input name="assessedAt" type="date" defaultValue={item.assessedAt} max={today} required className={cn("ltr-data w-44", state.errors.assessedAt && "border-danger")} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-bluegray">
            score 0–{max}
            <Input name="score" type="number" min={0} max={max} step={1} defaultValue={item.score} required className={cn("ltr-data w-24", state.errors.score && "border-danger")} />
          </label>
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-bluegray">
            note
            <Input name="note" defaultValue={item.note ?? ""} maxLength={500} />
          </label>
          <Button type="submit" size="sm" disabled={pending}>
            {tc("save")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            {tc("cancel")}
          </Button>
          {state.errors.score ? <span className="basis-full text-xs text-danger">{tErr("scoreRange", { max })}</span> : null}
          {state.errors.assessedAt ? <span className="basis-full text-xs text-danger">{tErr(state.errors.assessedAt === "dateFuture" ? "dateFuture" : "dateRequired")}</span> : null}
        </form>
      </td>
    </tr>
  );
}
