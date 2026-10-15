"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { catalogItems, type CatalogKind } from "@/db/schema";
import { requireSession } from "@/lib/auth/require-session";
import type { FieldErrors } from "@/lib/validation";

const KINDS: CatalogKind[] = ["diagnosis"];
const labelSchema = z.string().trim().min(2).max(120);

export type CatalogFormState = { errors: FieldErrors; ok?: boolean; savedAt?: number };

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

export async function addCatalogItemAction(kind: CatalogKind, _prev: CatalogFormState, formData: FormData): Promise<CatalogFormState> {
  await requireSession();
  if (!KINDS.includes(kind)) return { errors: { _: "invalid" } };
  const parsed = labelSchema.safeParse(formData.get("label"));
  if (!parsed.success) return { errors: { label: "invalid" } };

  const inserted = await getDb()
    .insert(catalogItems)
    .values({ kind, label: tidy(parsed.data) })
    .onConflictDoNothing()
    .returning({ id: catalogItems.id });
  if (inserted.length === 0) return { errors: { label: "duplicate" } };

  revalidatePath("/", "layout");
  return { errors: {}, ok: true, savedAt: Date.now() };
}

export async function renameCatalogItemAction(id: string, _prev: CatalogFormState, formData: FormData): Promise<CatalogFormState> {
  await requireSession();
  const parsed = labelSchema.safeParse(formData.get("label"));
  if (!parsed.success) return { errors: { label: "invalid" } };
  await getDb().update(catalogItems).set({ label: tidy(parsed.data) }).where(eq(catalogItems.id, id));
  revalidatePath("/", "layout");
  return { errors: {}, ok: true, savedAt: Date.now() };
}

export async function toggleCatalogItemAction(id: string, active: boolean): Promise<void> {
  await requireSession();
  await getDb().update(catalogItems).set({ active }).where(eq(catalogItems.id, id));
  revalidatePath("/", "layout");
}

export async function deleteCatalogItemAction(id: string, kind: CatalogKind): Promise<void> {
  await requireSession();
  await getDb().delete(catalogItems).where(and(eq(catalogItems.id, id), eq(catalogItems.kind, kind)));
  revalidatePath("/", "layout");
}
