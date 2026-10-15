import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./index";
import { assessments, catalogItems, clinicians, notes, patients, type Assessment, type CatalogItem, type CatalogKind, type Center, type Clinician, type Patient, type Note } from "./schema";
import { ensureSettings } from "./settings";
import { derivePatient, summarizeCaseload, type AssessmentPoint, type CaseloadKpis, type MetricSettings, type PatientDerived } from "@/lib/metrics";
import { splitNames } from "@/lib/import/normalize";

export type CaseloadRow = { patient: Patient; derived: PatientDerived };

export function toPoint(a: Assessment): AssessmentPoint {
  return {
    id: a.id,
    scale: a.scale,
    score: a.score,
    assessedAt: a.assessedAt,
    dateSource: a.dateSource,
    createdAt: a.createdAt.toISOString(),
  };
}

export function metricSettings(s: Awaited<ReturnType<typeof ensureSettings>>): MetricSettings {
  return {
    phqChangeThreshold: s.phqChangeThreshold,
    gadChangeThreshold: s.gadChangeThreshold,
    checkIntervalMonths: s.checkIntervalMonths,
    dueSoonDays: s.dueSoonDays,
    confirmActiveDays: s.confirmActiveDays,
    attendanceConcernDays: s.attendanceConcernDays,
  };
}

/** Whole caseload for a center (or all), derived in memory. ~200 patients: two queries, no joins needed. */
export async function getCaseload(center: Center | null, today = new Date()) {
  const db = getDb();
  const settings = metricSettings(await ensureSettings(db));

  const rows = center
    ? await db.select().from(patients).where(eq(patients.center, center)).orderBy(asc(patients.mrn))
    : await db.select().from(patients).orderBy(asc(patients.center), asc(patients.mrn));

  const ids = rows.map((p) => p.id);
  const scores = ids.length
    ? await db.select().from(assessments).where(inArray(assessments.patientId, ids))
    : [];

  const byPatient = new Map<string, AssessmentPoint[]>();
  for (const a of scores) {
    const list = byPatient.get(a.patientId) ?? [];
    list.push(toPoint(a));
    byPatient.set(a.patientId, list);
  }

  const caseload: CaseloadRow[] = rows.map((patient) => ({
    patient,
    derived: derivePatient(patient, byPatient.get(patient.id) ?? [], settings, today),
  }));

  const kpis: CaseloadKpis = summarizeCaseload(
    caseload.map((r) => ({ status: r.patient.status, derived: r.derived })),
  );

  return { caseload, kpis, settings };
}

export type PatientDetail = {
  patient: Patient;
  assessments: Assessment[];
  notes: Note[];
  derived: PatientDerived;
  settings: MetricSettings;
};

export async function getPatientDetail(id: string, today = new Date()): Promise<PatientDetail | null> {
  const db = getDb();
  const [patient] = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
  if (!patient) return null;
  const settings = metricSettings(await ensureSettings(db));
  const [scores, patientNotes] = await Promise.all([
    db
      .select()
      .from(assessments)
      .where(eq(assessments.patientId, id))
      .orderBy(asc(assessments.assessedAt), asc(assessments.createdAt)),
    db.select().from(notes).where(eq(notes.patientId, id)).orderBy(desc(notes.occurredAt), desc(notes.createdAt)),
  ]);
  return {
    patient,
    assessments: scores,
    notes: patientNotes,
    derived: derivePatient(patient, scores.map(toPoint), settings, today),
    settings,
  };
}

/** Distinct clinician names across the scope, for filter dropdowns. */
export function listClinicians(rows: Patient[]): { psychiatrists: string[]; psychologists: string[] } {
  const psychiatrists = new Set<string>();
  const psychologists = new Set<string>();
  for (const p of rows) {
    splitNames(p.psychiatrist).forEach((n) => psychiatrists.add(n));
    splitNames(p.psychologist).forEach((n) => psychologists.add(n));
  }
  const sort = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b));
  return { psychiatrists: sort(psychiatrists), psychologists: sort(psychologists) };
}

export async function mrnExists(center: Center, mrn: string, exceptId?: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.center, center), eq(patients.mrn, mrn)))
    .limit(2);
  return rows.some((r) => r.id !== exceptId);
}

export async function getClinicians(): Promise<Clinician[]> {
  return getDb().select().from(clinicians).orderBy(asc(clinicians.specialty), asc(clinicians.name));
}

export async function getCatalog(kind: CatalogKind): Promise<CatalogItem[]> {
  return getDb().select().from(catalogItems).where(eq(catalogItems.kind, kind)).orderBy(asc(catalogItems.label));
}
