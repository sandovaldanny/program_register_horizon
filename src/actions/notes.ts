"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { notes } from "@/db/schema";
import { requireSession } from "@/lib/auth/require-session";
import { fieldErrors, formEntries, noteSchema, type FieldErrors } from "@/lib/validation";

export type NoteFormState = { errors: FieldErrors; ok?: boolean; savedAt?: number };

export async function addNoteAction(_prev: NoteFormState, formData: FormData): Promise<NoteFormState> {
  const session = await requireSession();
  const parsed = noteSchema.safeParse(formEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await getDb().insert(notes).values({ ...parsed.data, author: session.sub });
  revalidatePath(`/patients/${parsed.data.patientId}`);
  return { errors: {}, ok: true, savedAt: Date.now() };
}

export async function deleteNoteAction(id: string, patientId: string): Promise<void> {
  await requireSession();
  await getDb().delete(notes).where(eq(notes.id, id));
  revalidatePath(`/patients/${patientId}`);
}
