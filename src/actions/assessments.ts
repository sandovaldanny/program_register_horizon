"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { assessments } from "@/db/schema";
import { requireSession } from "@/lib/auth/require-session";
import { assessmentSchema, fieldErrors, formEntries, type FieldErrors } from "@/lib/validation";

export type AssessmentFormState = { errors: FieldErrors; ok?: boolean; savedAt?: number };

export async function addAssessmentAction(_prev: AssessmentFormState, formData: FormData): Promise<AssessmentFormState> {
  await requireSession();
  const parsed = assessmentSchema.safeParse(formEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await getDb().insert(assessments).values({ ...parsed.data, source: "manual" });
  revalidatePath("/", "layout");
  return { errors: {}, ok: true, savedAt: Date.now() };
}

export async function updateAssessmentAction(id: string, _prev: AssessmentFormState, formData: FormData): Promise<AssessmentFormState> {
  await requireSession();
  const parsed = assessmentSchema.safeParse(formEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  // Any manual edit of a score or date makes it a recorded value.
  await getDb()
    .update(assessments)
    .set({ score: parsed.data.score, assessedAt: parsed.data.assessedAt, note: parsed.data.note, dateSource: "recorded" })
    .where(eq(assessments.id, id));
  revalidatePath("/", "layout");
  return { errors: {}, ok: true, savedAt: Date.now() };
}

export async function deleteAssessmentAction(id: string): Promise<void> {
  await requireSession();
  await getDb().delete(assessments).where(eq(assessments.id, id));
  revalidatePath("/", "layout");
}
