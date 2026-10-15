import type { NewAssessment, NewNote, NewPatient } from "@/db/schema";

export type ImportedAssessment = Pick<NewAssessment, "scale" | "score" | "assessedAt" | "dateSource" | "note">;
export type ImportedNote = Pick<NewNote, "kind" | "body" | "occurredAt">;

export type ImportedPatient = {
  patient: Omit<NewPatient, "id" | "createdAt" | "updatedAt">;
  /** Insertion order matters: baseline first, latest last (same-day tie-break by created_at). */
  assessments: ImportedAssessment[];
  notes: ImportedNote[];
  anomalies: string[];
};

export type RowMapper = (row: unknown[], headers: Map<string, number>, opts: MapperOptions) => ImportedPatient | null;

export type MapperOptions = {
  /** Months between screenings, used to back-date a missing last-score date from "Next check due". */
  checkIntervalMonths: number;
  /** When true, free-text notes are not imported (PII review). */
  skipNotes: boolean;
};
