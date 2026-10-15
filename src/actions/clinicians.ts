"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { clinicians } from "@/db/schema";
import { requireSession } from "@/lib/auth/require-session";
import { normalizeClinicianName } from "@/lib/import/normalize";
import { fieldErrors, formEntries, type FieldErrors } from "@/lib/validation";

const clinicianSchema = z.object({
  name: z.string().trim().min(2).max(120),
  specialty: z.enum(["psychiatrist", "psychologist", "other"]),
  center: z
    .union([z.literal(""), z.enum(["al_falah", "al_bateen"])])
    .transform((v) => (v === "" ? null : v))
    .optional(),
});

export type ClinicianFormState = { errors: FieldErrors; ok?: boolean; savedAt?: number };

export async function addClinicianAction(_prev: ClinicianFormState, formData: FormData): Promise<ClinicianFormState> {
  await requireSession();
  const parsed = clinicianSchema.safeParse(formEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const name = normalizeClinicianName(parsed.data.name);
  if (!name) return { errors: { name: "invalid" } };

  const inserted = await getDb()
    .insert(clinicians)
    .values({ name, specialty: parsed.data.specialty, center: parsed.data.center ?? null })
    .onConflictDoNothing()
    .returning({ id: clinicians.id });
  if (inserted.length === 0) return { errors: { name: "duplicate" } };

  revalidatePath("/", "layout");
  return { errors: {}, ok: true, savedAt: Date.now() };
}

export async function updateClinicianAction(id: string, _prev: ClinicianFormState, formData: FormData): Promise<ClinicianFormState> {
  await requireSession();
  const parsed = clinicianSchema.safeParse(formEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const name = normalizeClinicianName(parsed.data.name);
  if (!name) return { errors: { name: "invalid" } };

  await getDb()
    .update(clinicians)
    .set({ name, specialty: parsed.data.specialty, center: parsed.data.center ?? null })
    .where(eq(clinicians.id, id));
  revalidatePath("/", "layout");
  return { errors: {}, ok: true, savedAt: Date.now() };
}

export async function toggleClinicianAction(id: string, active: boolean): Promise<void> {
  await requireSession();
  await getDb().update(clinicians).set({ active }).where(eq(clinicians.id, id));
  revalidatePath("/", "layout");
}

export async function deleteClinicianAction(id: string): Promise<void> {
  await requireSession();
  await getDb().delete(clinicians).where(eq(clinicians.id, id));
  revalidatePath("/", "layout");
}
