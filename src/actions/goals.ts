"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { goals, type GoalStatus } from "@/db/schema";
import { requireSession } from "@/lib/auth/require-session";
import { fieldErrors, formEntries, type FieldErrors } from "@/lib/validation";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional();

const goalSchema = z.object({
  patientId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  category: text(120),
  targetDate: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  notes: text(2000),
});

export type GoalFormState = { errors: FieldErrors; ok?: boolean; savedAt?: number };

export async function addGoalAction(_prev: GoalFormState, formData: FormData): Promise<GoalFormState> {
  await requireSession();
  const parsed = goalSchema.safeParse(formEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  await getDb().insert(goals).values(parsed.data);
  revalidatePath(`/patients/${parsed.data.patientId}`);
  return { errors: {}, ok: true, savedAt: Date.now() };
}

export async function updateGoalAction(id: string, _prev: GoalFormState, formData: FormData): Promise<GoalFormState> {
  await requireSession();
  const parsed = goalSchema.safeParse(formEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { patientId, ...rest } = parsed.data;
  await getDb()
    .update(goals)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(goals.id, id));
  revalidatePath(`/patients/${patientId}`);
  return { errors: {}, ok: true, savedAt: Date.now() };
}

export async function setGoalStatusAction(id: string, patientId: string, status: GoalStatus): Promise<void> {
  await requireSession();
  await getDb()
    .update(goals)
    .set({
      status,
      achievedAt: status === "achieved" ? new Date().toISOString().slice(0, 10) : null,
      updatedAt: new Date(),
    })
    .where(eq(goals.id, id));
  revalidatePath(`/patients/${patientId}`);
}

export async function deleteGoalAction(id: string, patientId: string): Promise<void> {
  await requireSession();
  await getDb().delete(goals).where(eq(goals.id, id));
  revalidatePath(`/patients/${patientId}`);
}
