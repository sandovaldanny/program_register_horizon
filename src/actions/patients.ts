"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { mrnExists } from "@/db/queries";
import { patients } from "@/db/schema";
import { requireSession } from "@/lib/auth/require-session";
import { fieldErrors, formEntries, patientSchema, type FieldErrors } from "@/lib/validation";

export type PatientFormState = { errors: FieldErrors; ok?: boolean };

export async function createPatientAction(_prev: PatientFormState, formData: FormData): Promise<PatientFormState> {
  await requireSession();
  const parsed = patientSchema.safeParse(formEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (await mrnExists(parsed.data.center, parsed.data.mrn)) return { errors: { mrn: "mrnDuplicate" } };

  const [row] = await getDb().insert(patients).values(parsed.data).returning({ id: patients.id });
  revalidatePath("/", "layout");
  redirect(`/patients/${row.id}`);
}

export async function updatePatientAction(id: string, _prev: PatientFormState, formData: FormData): Promise<PatientFormState> {
  await requireSession();
  const parsed = patientSchema.safeParse(formEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  if (await mrnExists(parsed.data.center, parsed.data.mrn, id)) return { errors: { mrn: "mrnDuplicate" } };

  await getDb()
    .update(patients)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(patients.id, id));
  revalidatePath("/", "layout");
  redirect(`/patients/${id}`);
}

export async function setPatientStatusAction(id: string, status: "active" | "inactive" | "graduated" | "transferred"): Promise<void> {
  await requireSession();
  await getDb().update(patients).set({ status, updatedAt: new Date() }).where(eq(patients.id, id));
  revalidatePath("/", "layout");
}
