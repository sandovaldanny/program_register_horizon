"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  addCatalogItemAction,
  deleteCatalogItemAction,
  renameCatalogItemAction,
  toggleCatalogItemAction,
  type CatalogFormState,
} from "@/actions/catalog";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import type { CatalogItem, CatalogKind } from "@/db/schema";
import { cn } from "@/lib/cn";

export function CatalogManager({ kind, items }: { kind: CatalogKind; items: CatalogItem[] }) {
  const t = useTranslations("settings.catalog");
  const tc = useTranslations("common");
  const bound = addCatalogItemAction.bind(null, kind);
  const [state, action, pending] = useActionState<CatalogFormState, FormData>(bound, { errors: {} });
  const [editing, setEditing] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.savedAt, state.ok]);

  return (
    <div className="flex flex-col gap-4">
      <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface-soft/40 p-4">
        <Field label={t("label")} htmlFor={`cat-${kind}`} hint={state.errors.label ? t(`errors.${state.errors.label === "duplicate" ? "duplicate" : "invalid"}`) : undefined} className="min-w-64 flex-1">
          <Input id={`cat-${kind}`} name="label" required className={cn(state.errors.label && "border-danger")} />
        </Field>
        <Button type="submit" disabled={pending}>
          {t("add")}
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-bluegray">{t("empty")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) =>
            editing === item.id ? (
              <EditChip key={item.id} item={item} onDone={() => setEditing(null)} />
            ) : (
              <li
                key={item.id}
                className={cn(
                  "group inline-flex items-center gap-1 rounded-full border border-border bg-surface ps-3 pe-1 py-1 text-sm text-indigo",
                  !item.active && "opacity-50",
                )}
              >
                <span className="font-medium">{item.label}</span>
                {!item.active ? <Badge tone="warn">{t("inactive")}</Badge> : null}
                <button type="button" onClick={() => setEditing(item.id)} className="rounded-full px-2 text-xs text-bluegray hover:bg-surface-soft hover:text-indigo" title={tc("edit")}>
                  ✎
                </button>
                <form action={() => toggleCatalogItemAction(item.id, !item.active)}>
                  <button type="submit" className="rounded-full px-2 text-xs text-bluegray hover:bg-surface-soft hover:text-indigo" title={item.active ? t("deactivate") : t("activate")}>
                    {item.active ? "◌" : "●"}
                  </button>
                </form>
                <form
                  action={() => deleteCatalogItemAction(item.id, kind)}
                  onSubmit={(e) => {
                    if (!window.confirm(t("confirmDelete", { label: item.label }))) e.preventDefault();
                  }}
                >
                  <button type="submit" className="rounded-full px-2 text-xs text-bluegray hover:bg-danger-soft/50 hover:text-danger" title={tc("delete")}>
                    ×
                  </button>
                </form>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function EditChip({ item, onDone }: { item: CatalogItem; onDone: () => void }) {
  const tc = useTranslations("common");
  const bound = renameCatalogItemAction.bind(null, item.id);
  const [, action, pending] = useActionState<CatalogFormState, FormData>(
    async (prev, fd) => {
      const next = await bound(prev, fd);
      if (next.ok) onDone();
      return next;
    },
    { errors: {} },
  );
  return (
    <li className="inline-flex">
      <form action={action} className="inline-flex items-center gap-1">
        <Input name="label" defaultValue={item.label} required className="w-56 py-1" autoFocus />
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
