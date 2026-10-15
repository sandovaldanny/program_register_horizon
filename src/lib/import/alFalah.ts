import { SCALE_MAX } from "@/lib/metrics/severity";
import {
  cellDate,
  cellNumber,
  cellText,
  joinNames,
  mapPriority,
  mapYesNo,
  pick,
  scoreOrNull,
  splitSpecialists,
} from "./normalize";
import type { ImportedAssessment, ImportedPatient, RowMapper } from "./types";

export const AL_FALAH_SHEET = "September 26";
export const AL_FALAH_HEADER_ROW = 2;

/**
 * PHM review - Al Falah. One row per patient with Baseline + last score for
 * each scale and a single "Last test" date. Rule agreed with the user:
 * baseline and latest share that date (baseline flagged `estimated`), and
 * coordinators correct dates in the app.
 */
export const mapAlFalahRow: RowMapper = (row, headers, opts) => {
  const mrn = cellText(pick(row, headers, "MRN"));
  if (!mrn) return null;

  const anomalies: string[] = [];
  const lastTest = cellDate(pick(row, headers, "Last test"));
  const lastSession = cellDate(pick(row, headers, "Last session"));
  const anchor = lastTest ?? lastSession;

  const assessments: ImportedAssessment[] = [];
  const pushScale = (scale: "phq9" | "gad7", baselineHeader: string, lastHeader: string) => {
    const base = scoreOrNull(pick(row, headers, baselineHeader), SCALE_MAX[scale]);
    const last = scoreOrNull(pick(row, headers, lastHeader), SCALE_MAX[scale]);
    if (base.error) anomalies.push(`${scale} baseline: ${base.error}`);
    if (last.error) anomalies.push(`${scale} last: ${last.error}`);
    const values = [base.value, last.value].filter((v): v is number => v !== null);
    if (values.length === 0) return;
    if (!anchor) {
      anomalies.push(`${scale}: scores present but no date; skipped`);
      return;
    }
    if (values.length === 2) {
      assessments.push({ scale, score: values[0], assessedAt: anchor, dateSource: "estimated", note: "Imported baseline; date estimated" });
      assessments.push({ scale, score: values[1], assessedAt: anchor, dateSource: lastTest ? "recorded" : "estimated", note: null });
    } else {
      assessments.push({ scale, score: values[0], assessedAt: anchor, dateSource: lastTest ? "recorded" : "estimated", note: null });
    }
  };
  pushScale("phq9", "Baseline PHQ score", "last PHQ score");
  pushScale("gad7", "Baseline GAD score", "Last GAD score");

  const specialists = splitSpecialists(cellText(pick(row, headers, "Specialists involved")));
  const attendancePct = cellNumber(pick(row, headers, "Attendance %"));

  const notes: ImportedPatient["notes"] = [];
  const freeNote = cellText(pick(row, headers, "Notes"));
  if (freeNote && !opts.skipNotes) notes.push({ kind: "note", body: freeNote, occurredAt: lastSession ?? undefined });

  const provenance = [
    `Imported from PHM review (${AL_FALAH_SHEET}).`,
    cellText(pick(row, headers, "Follow up reason")) && `Follow-up reason: ${cellText(pick(row, headers, "Follow up reason"))}.`,
    cellText(pick(row, headers, "PHQ trend")) && `PHQ trend (sheet): ${cellText(pick(row, headers, "PHQ trend"))}.`,
    cellText(pick(row, headers, "GAD trend")) && `GAD trend (sheet): ${cellText(pick(row, headers, "GAD trend"))}.`,
    cellText(pick(row, headers, "Current severity group")) && `Current severity (sheet): ${cellText(pick(row, headers, "Current severity group"))}.`,
    anomalies.length && `Anomalies: ${anomalies.join("; ")}.`,
  ]
    .filter(Boolean)
    .join(" ");
  notes.push({ kind: "import", body: provenance });

  return {
    patient: {
      center: "al_falah",
      mrn,
      displayName: null,
      age: cellNumber(pick(row, headers, "Age")),
      gender: "unknown",
      status: "active",
      diagnosis: cellText(pick(row, headers, "Diagnosis")),
      carePlan: cellText(pick(row, headers, "Care Plan")),
      therapyProgress: cellText(pick(row, headers, "Therapy progress")),
      psychiatrist: joinNames(specialists.psychiatrist),
      psychologist: joinNames(specialists.psychologist),
      medication: mapYesNo(cellText(pick(row, headers, "Medication"))),
      medicationAdherence: cellText(pick(row, headers, "Medication Adherence")),
      sessionsCount: cellNumber(pick(row, headers, "Sessions")),
      attendancePct: attendancePct === null ? null : attendancePct.toFixed(2),
      attendancePattern: null,
      lastSessionDate: lastSession,
      reasonNotAttending: null,
      isHorizonPatient: null,
      followUpPriority: mapPriority(cellText(pick(row, headers, "Follow up priority"))),
      ccAction: cellText(pick(row, headers, "CC Action")),
      outcome: cellText(pick(row, headers, "Outcome")),
      initialSeverityLabel: cellText(pick(row, headers, "Initial Severity group")),
    },
    assessments,
    notes,
    anomalies,
  };
};
