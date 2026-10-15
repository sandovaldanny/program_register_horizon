"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { ensureSettings } from "@/db/settings";
import { requireSession } from "@/lib/auth/require-session";
import { fieldErrors, formEntries, settingsSchema, type FieldErrors } from "@/lib/validation";

export type SettingsFormState = { errors: FieldErrors; ok?: boolean; savedAt?: number };

export async function updateSettingsAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireSession();
  const parsed = settingsSchema.safeParse(formEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const db = getDb();
  await ensureSettings(db);
  await db
    .update(settings)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(settings.id, 1));
  revalidatePath("/", "layout");
  return { errors: {}, ok: true, savedAt: Date.now() };
}
