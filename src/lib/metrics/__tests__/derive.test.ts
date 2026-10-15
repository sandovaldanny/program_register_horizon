import { describe, expect, it } from "vitest";
import { derivePatient, summarizeCaseload } from "../derive";
import { PRIORITY_WEIGHTS } from "../flags";
import { DEFAULT_METRIC_SETTINGS, type AssessmentPoint, type PatientInput } from "../types";

const S = DEFAULT_METRIC_SETTINGS;
const TODAY = new Date("2026-10-15T12:00:00Z");

let seq = 0;
const pt = (scale: "phq9" | "gad7", score: number, assessedAt: string): AssessmentPoint => ({
  id: `a${++seq}`,
  scale,
  score,
  assessedAt,
  dateSource: "recorded",
  createdAt: `${assessedAt}T00:00:${String(seq).padStart(2, "0")}.000Z`,
});

const patient = (overrides: Partial<PatientInput> = {}): PatientInput => ({
  status: "active",
  followUpPriority: "routine",
  lastSessionDate: "2026-10-10",
  carePlan: "Psychotherapy",
  ...overrides,
});

describe("derivePatient", () => {
  it("active patient with no scores → no_scores flag only", () => {
    const d = derivePatient(patient(), [], S, TODAY);
    expect(d.tier).toBeNull();
    expect(d.trend).toBeNull();
    expect(d.assessmentStatus).toBe("no_scores");
    expect(d.flags).toEqual(["no_scores"]);
    expect(d.priorityScore).toBe(PRIORITY_WEIGHTS.no_scores);
  });

  it("recent improving patient → no flags, zero priority", () => {
    const d = derivePatient(
      patient(),
      [pt("phq9", 20, "2026-08-01"), pt("phq9", 8, "2026-10-01"), pt("gad7", 15, "2026-08-01"), pt("gad7", 6, "2026-10-01")],
      S,
      TODAY,
    );
    expect(d.phq.delta).toBe(-12);
    expect(d.gad.delta).toBe(-9);
    expect(d.trend).toBe("improving");
    expect(d.tier).toBe("tier1");
    expect(d.lastScoreDate).toBe("2026-10-01");
    expect(d.nextDueDate).toBe("2026-11-01");
    expect(d.flags).toEqual([]);
    expect(d.priorityScore).toBe(0);
  });

  it("worsening severe overdue patient stacks flags and priority", () => {
    const d = derivePatient(
      patient({ followUpPriority: "high", lastSessionDate: "2026-08-01" }),
      [pt("phq9", 12, "2026-06-01"), pt("phq9", 22, "2026-08-20"), pt("gad7", 10, "2026-06-01"), pt("gad7", 16, "2026-08-20")],
      S,
      TODAY,
    );
    expect(d.trend).toBe("worsening");
    expect(d.tier).toBe("tier3");
    expect(d.assessmentStatus).toBe("overdue");
    expect(d.attendanceStatus).toBe("concern");
    expect(d.flags).toEqual(["high_priority", "worsening", "severe", "assessment_overdue", "attendance_concern"]);
    expect(d.priorityScore).toBeGreaterThan(
      PRIORITY_WEIGHTS.high_priority + PRIORITY_WEIGHTS.worsening + PRIORITY_WEIGHTS.severe + PRIORITY_WEIGHTS.assessment_overdue + PRIORITY_WEIGHTS.attendance_concern,
    );
  });

  it("delta always uses baseline → latest even with five scores", () => {
    const d = derivePatient(
      patient(),
      [
        pt("phq9", 18, "2026-05-01"),
        pt("phq9", 20, "2026-06-01"),
        pt("phq9", 15, "2026-07-01"),
        pt("phq9", 22, "2026-08-01"),
        pt("phq9", 13, "2026-10-01"),
      ],
      S,
      TODAY,
    );
    expect(d.phq.history).toHaveLength(5);
    expect(d.phq.baseline?.score).toBe(18);
    expect(d.phq.latest?.score).toBe(13);
    expect(d.phq.delta).toBe(-5);
    expect(d.phq.trend).toBe("improving");
  });

  it("minimal latest scores on both scales → minimal_scores flag", () => {
    const d = derivePatient(
      patient(),
      [pt("phq9", 14, "2026-08-01"), pt("phq9", 2, "2026-10-01"), pt("gad7", 11, "2026-08-01"), pt("gad7", 3, "2026-10-01")],
      S,
      TODAY,
    );
    expect(d.tier).toBe("minimal");
    expect(d.flags).toEqual(["minimal_scores"]);
  });

  it("missing care plan → care_plan_missing", () => {
    const d = derivePatient(patient({ carePlan: "  " }), [pt("phq9", 6, "2026-10-01")], S, TODAY);
    expect(d.flags).toContain("care_plan_missing");
  });

  it("inactive / graduated patients get no time-based flags", () => {
    const d = derivePatient(
      patient({ status: "graduated", lastSessionDate: "2026-01-01", followUpPriority: "high" }),
      [pt("phq9", 25, "2026-01-01")],
      S,
      TODAY,
    );
    expect(d.assessmentStatus).toBe("confirm_active");
    expect(d.flags).toEqual([]);
    expect(d.priorityScore).toBe(0);
  });

  it("threshold change flips a stable patient to improving", () => {
    const history = [pt("phq9", 15, "2026-08-01"), pt("phq9", 12, "2026-10-01")];
    expect(derivePatient(patient(), history, S, TODAY).phq.trend).toBe("stable");
    expect(derivePatient(patient(), history, { ...S, phqChangeThreshold: 3 }, TODAY).phq.trend).toBe("improving");
  });
});

describe("summarizeCaseload", () => {
  it("counts KPIs over active patients only", () => {
    const rows = [
      derivePatient(patient(), [], S, TODAY),
      derivePatient(patient({ status: "inactive" }), [], S, TODAY),
      derivePatient(patient(), [pt("phq9", 20, "2026-08-01"), pt("phq9", 25, "2026-08-25")], S, TODAY),
    ];
    const statuses: PatientInput["status"][] = ["active", "inactive", "active"];
    const k = summarizeCaseload(rows.map((derived, i) => ({ status: statuses[i], derived })));
    expect(k.active).toBe(2);
    expect(k.noScores).toBe(1);
    expect(k.overdue).toBe(1);
    expect(k.worsening).toBe(1);
    expect(k.severe).toBe(1);
    expect(k.needsAttention).toBe(2);
  });
});
