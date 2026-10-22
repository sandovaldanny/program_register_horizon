import { z } from "zod";
import { SCALE_MAX } from "@/lib/metrics/severity";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date")
  .refine((d) => !Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()), "date");

const notFuture = isoDate.refine((d) => d <= new Date().toISOString().slice(0, 10), "dateFuture");

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .transform((s) => (s === "" ? null : s))
  .nullable()
  .optional();

const optionalInt = (min: number, max: number) =>
  z
    .union([z.literal(""), z.coerce.number().int().min(min).max(max)])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const optionalDate = z
  .union([z.literal(""), isoDate])
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const patientBaseSchema = z.object({
  center: z.enum(["al_falah", "al_bateen"]),
  mrn: z.string().trim().min(1, "mrnRequired").max(64),
  displayName: optionalText,
  age: optionalInt(0, 120),
  gender: z.enum(["male", "female", "unknown"]).default("unknown"),
  status: z.enum(["active", "inactive"]).default("active"),
  enrolledAt: notFuture,
  unenrolledAt: optionalDate,
  unenrollReason: optionalText,
  diagnosis: optionalText,
  carePlan: optionalText,
  therapyProgress: optionalText,
  psychiatrist: optionalText,
  psychologist: optionalText,
  medication: z.enum(["yes", "no", "unknown"]).default("unknown"),
  medicationAdherence: optionalText,
  followUpPriority: z.enum(["routine", "low", "mid", "high"]).default("routine"),
  ccAction: optionalText,
  outcome: optionalText,
});

/** Unenrolling requires a date and a reason; re-enrolling clears both. */
export const patientSchema = patientBaseSchema
  .superRefine((v, ctx) => {
    if (v.status !== "inactive") return;
    if (!v.unenrolledAt) ctx.addIssue({ code: "custom", path: ["unenrolledAt"], message: "unenrolledAtRequired" });
    else if (v.unenrolledAt < v.enrolledAt) ctx.addIssue({ code: "custom", path: ["unenrolledAt"], message: "unenrolledBeforeEnrolled" });
    if (!v.unenrollReason) ctx.addIssue({ code: "custom", path: ["unenrollReason"], message: "unenrollReasonRequired" });
  })
  .transform((v) => (v.status === "active" ? { ...v, unenrolledAt: null, unenrollReason: null } : v));
export type PatientFormValues = z.infer<typeof patientSchema>;

/** Attendance is edited from the patient page. Total sessions = psychology + psychiatry. */
export const attendanceSchema = z
  .object({
    lastSessionDate: optionalDate,
    psychologySessions: optionalInt(0, 10000),
    psychiatrySessions: optionalInt(0, 10000),
    attendancePattern: z
      .union([z.literal(""), z.enum(["consistent", "irregular", "not_attending", "too_early"])])
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional(),
    reasonNotAttending: optionalText,
  })
  .transform((v) => {
    const psy = v.psychologySessions ?? null;
    const psych = v.psychiatrySessions ?? null;
    return { ...v, psychologySessions: psy, psychiatrySessions: psych, sessionsCount: psy === null && psych === null ? null : (psy ?? 0) + (psych ?? 0) };
  });

export const unenrollSchema = z.object({
  unenrolledAt: notFuture,
  unenrollReason: z.string().trim().min(1, "unenrollReasonRequired").max(200),
});

export const assessmentSchema = z
  .object({
    patientId: z.string().uuid(),
    scale: z.enum(["phq9", "gad7"]),
    score: z.coerce.number().int(),
    assessedAt: notFuture,
    dateSource: z.enum(["recorded", "estimated"]).default("recorded"),
    note: optionalText,
  })
  .superRefine((v, ctx) => {
    if (v.score < 0 || v.score > SCALE_MAX[v.scale]) {
      ctx.addIssue({ code: "custom", path: ["score"], message: "scoreRange" });
    }
  });

export const noteSchema = z.object({
  patientId: z.string().uuid(),
  kind: z.enum(["note", "action", "mdt"]).default("note"),
  body: z.string().trim().min(1).max(8000),
  occurredAt: notFuture,
});

export const settingsSchema = z.object({
  phqChangeThreshold: z.coerce.number().int().min(1).max(27),
  gadChangeThreshold: z.coerce.number().int().min(1).max(21),
  checkIntervalMonths: z.coerce.number().int().min(1).max(12),
  attendanceConcernDays: z.coerce.number().int().min(1).max(365),
});

export type FieldErrors = Record<string, string>;

/** Map zod issues to `{ field: messageKey }` (first issue per field wins). */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export const formEntries = (fd: FormData): Record<string, string> =>
  Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, typeof v === "string" ? v : ""]));

export const REASONS_NOT_ATTENDING = [
  "Cost / insurance",
  "Work or school clash",
  "Transport",
  "Cannot reach / no answer",
  "Feeling better",
  "Not ready / stigma",
  "Family not supportive",
  "Travelling / moved",
  "Changed provider",
] as const;
