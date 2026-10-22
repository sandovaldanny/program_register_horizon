"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { mrnExists } from "@/db/queries";
import { patients } from "@/db/schema";
import { requireSession } from "@/lib/auth/require-session";
import { attendanceSchema, fieldErrors, formEntries, patientSchema, unenrollSchema, type FieldErrors } from "@/lib/validation";

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

export type UnenrollFormState = { errors: FieldErrors; ok?: boolean };

/** Mark the patient as unenrolled: date and reason are mandatory. */
export async function unenrollPatientAction(id: string, _prev: UnenrollFormState, formData: FormData): Promise<UnenrollFormState> {
  await requireSession();
  const parsed = unenrollSchema.safeParse(formEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const [row] = await getDb().select({ enrolledAt: patients.enrolledAt }).from(patients).where(eq(patients.id, id)).limit(1);
  if (!row) return { errors: { _: "invalid" } };
  if (parsed.data.unenrolledAt < row.enrolledAt) return { errors: { unenrolledAt: "unenrolledBeforeEnrolled" } };

  await getDb()
    .update(patients)
    .set({ status: "inactive", unenrolledAt: parsed.data.unenrolledAt, unenrollReason: parsed.data.unenrollReason, updatedAt: new Date() })
    .where(eq(patients.id, id));
  revalidatePath("/", "layout");
  return { errors: {}, ok: true };
}

/** Back into the programme: new enrolment date, previous unenrolment cleared. */
export async function reenrollPatientAction(id: string): Promise<void> {
  await requireSession();
  const today = new Date().toISOString().slice(0, 10);
  await getDb()
    .update(patients)
    .set({ status: "active", enrolledAt: today, unenrolledAt: null, unenrollReason: null, updatedAt: new Date() })
    .where(eq(patients.id, id));
  revalidatePath("/", "layout");
}

export type AttendanceFormState = { errors: FieldErrors; ok?: boolean; savedAt?: number };

export async function updateAttendanceAction(id: string, _prev: AttendanceFormState, formData: FormData): Promise<AttendanceFormState> {
  await requireSession();
  const parsed = attendanceSchema.safeParse(formEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  await getDb()
    .update(patients)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(patients.id, id));
  revalidatePath("/", "layout");
  return { errors: {}, ok: true, savedAt: Date.now() };
}
