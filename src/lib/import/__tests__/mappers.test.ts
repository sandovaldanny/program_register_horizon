import { describe, expect, it } from "vitest";
import { mapAlBateenRow } from "../alBateen";
import { mapAlFalahRow } from "../alFalah";
import { headerIndex } from "../normalize";

const OPTS = { checkIntervalMonths: 1, skipNotes: false };
const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const falahHeaders = headerIndex([
  "MRN", "Age", "Initial Severity group ", "Current severity group ", "Diagnosis", "Last test",
  "Baseline PHQ score", "last PHQ score", "PHQ trend ", "Baseline GAD score", "Last GAD score", "GAD trend",
  "Care Plan ", "Therapy progress", "Specialists involved", "Last session ", "Sessions", "Attendance %",
  "Medication", "Medication Adherence", "Notes", "Follow up reason", "Follow up priority ", "CC Action", "Status", "Outcome",
]);

describe("mapAlFalahRow", () => {
  it("baseline + last → two assessments per scale on the same date, baseline first & estimated", () => {
    const row = [
      "Patient 101", 47, "Severe Anxiety + Severe Depression", null, "Depression + anxiety", D("2026-09-23"),
      27, 21, "Improving", 21, 4, "Improving",
      "Psychotherapy ", null, "Dr. Ramy, Amal", D("2026-09-23"), 1, 100,
      "No", null, null, "Severe depression", "High Priority", null, null, null,
    ];
    const r = mapAlFalahRow(row, falahHeaders, OPTS)!;
    expect(r.patient).toMatchObject({
      center: "al_falah",
      mrn: "Patient 101",
      age: 47,
      carePlan: "Psychotherapy",
      psychiatrist: "Dr. Ramy",
      psychologist: "Amal",
      medication: "no",
      followUpPriority: "high",
      lastSessionDate: "2026-09-23",
      attendancePct: "100.00",
    });
    expect(r.assessments).toEqual([
      { scale: "phq9", score: 27, assessedAt: "2026-09-23", dateSource: "estimated", note: expect.any(String) },
      { scale: "phq9", score: 21, assessedAt: "2026-09-23", dateSource: "recorded", note: null },
      { scale: "gad7", score: 21, assessedAt: "2026-09-23", dateSource: "estimated", note: expect.any(String) },
      { scale: "gad7", score: 4, assessedAt: "2026-09-23", dateSource: "recorded", note: null },
    ]);
    expect(r.notes.map((n) => n.kind)).toEqual(["import"]);
    expect(r.anomalies).toEqual([]);
  });

  it("baseline only → one assessment per scale, recorded", () => {
    const row = ["Patient 100", 48, null, null, "Depression", D("2026-05-13"), 18, null, null, 15, null, null,
      "meds + psychotherapy", null, "Dr. Ramy, Amal", D("2026-09-17"), 1, 100, "Yes", null, null, "Assessment overdue", "Low Priority", null, null, null];
    const r = mapAlFalahRow(row, falahHeaders, OPTS)!;
    expect(r.assessments).toEqual([
      { scale: "phq9", score: 18, assessedAt: "2026-05-13", dateSource: "recorded", note: null },
      { scale: "gad7", score: 15, assessedAt: "2026-05-13", dateSource: "recorded", note: null },
    ]);
    expect(r.patient.followUpPriority).toBe("low");
    expect(r.patient.medication).toBe("yes");
  });

  it("out-of-range score is skipped and reported", () => {
    const row = ["Patient 139", 30, null, null, "Anxiety", D("2026-09-01"), 10, null, null, 29, null, null,
      "meds", null, "Dr. Amnha", D("2026-09-01"), 1, 100, "No", null, null, null, "Routine", null, null, null];
    const r = mapAlFalahRow(row, falahHeaders, OPTS)!;
    expect(r.assessments).toEqual([{ scale: "phq9", score: 10, assessedAt: "2026-09-01", dateSource: "recorded", note: null }]);
    expect(r.anomalies).toEqual(["gad7 baseline: score 29 outside 0–21"]);
    expect(r.notes[0].body).toContain("Anomalies");
    expect(r.patient.psychiatrist).toBe("Dr. Amnah");
  });

  it("skipNotes drops free text but keeps provenance", () => {
    const row = ["Patient 1", 30, null, null, null, D("2026-09-01"), 5, null, null, 5, null, null,
      null, null, null, null, null, null, null, null, "refusing cbt", null, null, null, null, null];
    const r = mapAlFalahRow(row, falahHeaders, { ...OPTS, skipNotes: true })!;
    expect(r.notes.map((n) => n.kind)).toEqual(["import"]);
    expect(mapAlFalahRow(row, falahHeaders, OPTS)!.notes.map((n) => n.kind)).toEqual(["note", "import"]);
  });

  it("returns null for an empty row", () => {
    expect(mapAlFalahRow([null, null], falahHeaders, OPTS)).toBeNull();
  });
});

const bateenHeaders = headerIndex([
  "MRN", "Patient name", "Age", "Gender", "Tier", "Trend", "First PHQ-9", "Latest PHQ-9", "PHQ-9 Delta", "PHQ-9 severity",
  "First GAD-7", "Latest GAD-7", "GAD-7 Delta", "GAD-7 severity", "Last score date", "Next check due", "Psychiatrist", "Psychologist",
  "Last seen (daily list)", "Reason if not attending", "Horizon Patient?", "Treatment goals", "Notes / actions",
]);

describe("mapAlBateenRow", () => {
  it("first + latest with last score date → both on that date", () => {
    const row = ["Patient 2", "Nombre 2", 32, "Male", { result: "Minimal (<5)" }, { result: "Improving" }, 9, 0, -9, { result: "Minimal" },
      15, 2, -13, { result: "Minimal" }, D("2026-10-08"), D("2026-11-08"), "Dr.Hudaib", "Fedaa", D("2026-10-08"), null, "Yes", null, null];
    const r = mapAlBateenRow(row, bateenHeaders, OPTS)!;
    expect(r.patient).toMatchObject({
      center: "al_bateen",
      mrn: "Patient 2",
      displayName: "Nombre 2",
      gender: "male",
      psychiatrist: "Dr. Hudaib",
      psychologist: "Fedaa",
      lastSessionDate: "2026-10-08",
      isHorizonPatient: true,
    });
    expect(r.assessments.map((a) => [a.scale, a.score, a.assessedAt, a.dateSource])).toEqual([
      ["phq9", 9, "2026-10-08", "estimated"],
      ["phq9", 0, "2026-10-08", "recorded"],
      ["gad7", 15, "2026-10-08", "estimated"],
      ["gad7", 2, "2026-10-08", "recorded"],
    ]);
  });

  it("first only without last score date → date from Next check due − 1 month, estimated", () => {
    const row = ["Patient 4", "Nombre 4", 23, "Female", null, null, 12, null, null, null, 7, null, null, null,
      null, D("2026-10-17"), "Dr. Ramez", "Lara", D("2026-10-08"), null, "Yes", null, null];
    const r = mapAlBateenRow(row, bateenHeaders, OPTS)!;
    expect(r.assessments.map((a) => [a.scale, a.score, a.assessedAt, a.dateSource])).toEqual([
      ["phq9", 12, "2026-09-17", "estimated"],
      ["gad7", 7, "2026-09-17", "estimated"],
    ]);
  });

  it("latest only → single recorded point; no scores → none", () => {
    const row = ["Patient 9", "Nombre 9", 40, "Female", null, null, null, 13, null, null, null, 14, null, null,
      D("2026-10-04"), D("2026-11-04"), "Dr. Divya", null, D("2026-10-04"), null, "No", null, null];
    const r = mapAlBateenRow(row, bateenHeaders, OPTS)!;
    expect(r.assessments.map((a) => [a.scale, a.score, a.assessedAt, a.dateSource])).toEqual([
      ["phq9", 13, "2026-10-04", "recorded"],
      ["gad7", 14, "2026-10-04", "recorded"],
    ]);
    expect(r.patient.isHorizonPatient).toBe(false);

    const empty = ["Patient 3", "Nombre 3", 18, "Male", null, null, null, null, null, null, null, null, null, null,
      null, D("2026-10-08"), "Dr. Hudaib", "Fedaa, Duree", D("2026-10-01"), null, "Yes", null, null];
    const e = mapAlBateenRow(empty, bateenHeaders, OPTS)!;
    expect(e.assessments).toEqual([]);
    expect(e.patient.psychologist).toBe("Fedaa, Duree");
  });

  it("MDT notes get the mdt kind", () => {
    const row = ["Patient 7", "Nombre 7", 42, "Female", null, null, null, null, null, null, null, null, null, null,
      null, D("2026-11-05"), "Dr. Hudaib", "Fedaa", D("2026-10-08"), null, "Yes", null, "MDT meeting (08/10/2026) - discussed"];
    const r = mapAlBateenRow(row, bateenHeaders, OPTS)!;
    expect(r.notes.map((n) => n.kind)).toEqual(["mdt", "import"]);
    expect(r.notes[0].occurredAt).toBe("2026-10-08");
  });
});
