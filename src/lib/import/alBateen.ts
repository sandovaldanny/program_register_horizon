import { SCALE_MAX } from "@/lib/metrics/severity";
import {
  cellDate,
  cellNumber,
  cellText,
  isoMinusMonths,
  joinNames,
  mapGender,
  mapYesNo,
  pick,
  scoreOrNull,
  splitNames,
} from "./normalize";
import type { ImportedAssessment, ImportedPatient, RowMapper } from "./types";

export const AL_BATEEN_SHEET = "Register";
export const AL_BATEEN_HEADER_ROW = 4;

/**
 * Care Coordinator Tracker - Al Bateen, "Register" sheet only (the other
 * sheets are not anonymized and are never read). First + Latest score per
 * scale, "Last score date" sometimes missing; "Next check due" is always
 * last score date + interval, so it is inverted when needed.
 */
export const mapAlBateenRow: RowMapper = (row, headers, opts) => {
  const mrn = cellText(pick(row, headers, "MRN"));
  if (!mrn) return null;

  const anomalies: string[] = [];
  const lastScoreDate = cellDate(pick(row, headers, "Last score date"));
  const nextCheckDue = cellDate(pick(row, headers, "Next check due"));
  const lastSeen = cellDate(pick(row, headers, "Last seen (daily list)"));

  let anchor: string | null = lastScoreDate;
  let anchorSource: "recorded" | "estimated" = "recorded";
  if (!anchor && nextCheckDue) {
    anchor = isoMinusMonths(nextCheckDue, opts.checkIntervalMonths);
    anchorSource = "estimated";
  }

  const assessments: ImportedAssessment[] = [];
  const pushScale = (scale: "phq9" | "gad7", firstHeader: string, latestHeader: string) => {
    const first = scoreOrNull(pick(row, headers, firstHeader), SCALE_MAX[scale]);
    const latest = scoreOrNull(pick(row, headers, latestHeader), SCALE_MAX[scale]);
    if (first.error) anomalies.push(`${scale} first: ${first.error}`);
    if (latest.error) anomalies.push(`${scale} latest: ${latest.error}`);
    const values = [first.value, latest.value].filter((v): v is number => v !== null);
    if (values.length === 0) return;
    if (!anchor) {
      anomalies.push(`${scale}: scores present but no usable date; skipped`);
      return;
    }
    if (values.length === 2) {
      assessments.push({ scale, score: values[0], assessedAt: anchor, dateSource: "estimated", note: "Imported first score; date estimated" });
      assessments.push({ scale, score: values[1], assessedAt: anchor, dateSource: anchorSource, note: anchorSource === "estimated" ? "Date estimated from Next check due" : null });
    } else {
      assessments.push({ scale, score: values[0], assessedAt: anchor, dateSource: anchorSource, note: anchorSource === "estimated" ? "Date estimated from Next check due" : null });
    }
  };
  pushScale("phq9", "First PHQ-9", "Latest PHQ-9");
  pushScale("gad7", "First GAD-7", "Latest GAD-7");

  const notes: ImportedPatient["notes"] = [];
  const actions = cellText(pick(row, headers, "Notes / actions"));
  if (actions && !opts.skipNotes) {
    notes.push({ kind: /^mdt\b/i.test(actions) ? "mdt" : "note", body: actions, occurredAt: lastSeen ?? undefined });
  }
  const provenance = [
    `Imported from Care Coordinator Tracker (${AL_BATEEN_SHEET}).`,
    cellText(pick(row, headers, "Trend")) && `Trend (sheet): ${cellText(pick(row, headers, "Trend"))}.`,
    anomalies.length && `Anomalies: ${anomalies.join("; ")}.`,
  ]
    .filter(Boolean)
    .join(" ");
  notes.push({ kind: "import", body: provenance });

  const horizon = mapYesNo(cellText(pick(row, headers, "Horizon Patient?")));

  return {
    patient: {
      center: "al_bateen",
      mrn,
      displayName: cellText(pick(row, headers, "Patient name")),
      age: cellNumber(pick(row, headers, "Age")),
      gender: mapGender(cellText(pick(row, headers, "Gender"))),
      status: "active",
      diagnosis: null,
      carePlan: null,
      therapyProgress: null,
      psychiatrist: joinNames(splitNames(cellText(pick(row, headers, "Psychiatrist")))),
      psychologist: joinNames(splitNames(cellText(pick(row, headers, "Psychologist")))),
      medication: "unknown",
      medicationAdherence: null,
      sessionsCount: null,
      attendancePct: null,
      attendancePattern: null,
      lastSessionDate: lastSeen,
      reasonNotAttending: cellText(pick(row, headers, "Reason if not attending")),
      isHorizonPatient: horizon === "unknown" ? null : horizon === "yes",
      followUpPriority: "routine",
      ccAction: null,
      outcome: null,
      initialSeverityLabel: null,
    },
    assessments,
    notes,
    anomalies,
  };
};
