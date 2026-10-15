import { describe, expect, it } from "vitest";
import { derivePatient, summarizeCaseload } from "../derive";
import { HIGH_PRIORITY_BONUS, PRIORITY_WEIGHTS } from "../flags";
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
  ...overrides,
});

describe("derivePatient — the four rules", () => {
  it("rule 4: no scores at all → no_baseline only", () => {
    const d = derivePatient(patient(), [], S, TODAY);
    expect(d.maxSeverity).toBeNull();
    expect(d.trend).toBeNull();
    expect(d.assessmentStatus).toBe("no_scores");
    expect(d.flags).toEqual(["no_baseline"]);
    expect(d.priorityScore).toBe(PRIORITY_WEIGHTS.no_baseline);
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
    expect(d.maxSeverity).toBe("mild");
    expect(d.lastScoreDate).toBe("2026-10-01");
    expect(d.nextDueDate).toBe("2026-11-01");
    expect(d.flags).toEqual([]);
    expect(d.needsAttention).toBe(false);
    expect(d.priorityScore).toBe(0);
  });

  it("rules 1+2+3 together: worsening, overdue score, no session → all three flags", () => {
    const d = derivePatient(
      patient({ lastSessionDate: "2026-08-01" }),
      [pt("phq9", 12, "2026-06-01"), pt("phq9", 22, "2026-08-20"), pt("gad7", 10, "2026-06-01"), pt("gad7", 16, "2026-08-20")],
      S,
      TODAY,
    );
    expect(d.trend).toBe("worsening");
    expect(d.severeRange).toBe(true);
    expect(d.assessmentStatus).toBe("overdue");
    expect(d.attendanceStatus).toBe("concern");
    expect(d.flags).toEqual(["worsening", "no_score", "no_session"]);
    const base = PRIORITY_WEIGHTS.worsening + PRIORITY_WEIGHTS.no_score + PRIORITY_WEIGHTS.no_session;
    expect(d.priorityScore).toBeGreaterThan(base);
    expect(d.priorityScore).toBeLessThan(base + 1);
  });

  it("manual High follow-up priority adds a bonus but is not a flag", () => {
    const history = [pt("phq9", 10, "2026-07-01"), pt("phq9", 18, "2026-09-01")];
    const routine = derivePatient(patient(), history, S, TODAY);
    const high = derivePatient(patient({ followUpPriority: "high" }), history, S, TODAY);
    expect(high.flags).toEqual(routine.flags);
    expect(high.priorityScore - routine.priorityScore).toBe(HIGH_PRIORITY_BONUS);
  });

  it("High priority alone (no flags) does not create work", () => {
    const d = derivePatient(patient({ followUpPriority: "high" }), [pt("phq9", 6, "2026-10-01")], S, TODAY);
    expect(d.flags).toEqual([]);
    expect(d.priorityScore).toBe(0);
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

  it("minimal latest scores on both scales → graduation candidate, not a flag", () => {
    const d = derivePatient(
      patient(),
      [pt("phq9", 14, "2026-08-01"), pt("phq9", 2, "2026-10-01"), pt("gad7", 11, "2026-08-01"), pt("gad7", 3, "2026-10-01")],
      S,
      TODAY,
    );
    expect(d.graduationCandidate).toBe(true);
    expect(d.flags).toEqual([]);
  });

  it("inactive patients get no flags at all", () => {
    const d = derivePatient(
      patient({ status: "inactive", lastSessionDate: "2026-01-01", followUpPriority: "high" }),
      [pt("phq9", 25, "2026-01-01")],
      S,
      TODAY,
    );
    expect(d.assessmentStatus).toBe("overdue");
    expect(d.flags).toEqual([]);
    expect(d.priorityScore).toBe(0);
    expect(d.graduationCandidate).toBe(false);
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
      derivePatient(patient(), [pt("phq9", 12, "2026-08-01"), pt("phq9", 3, "2026-10-01")], S, TODAY),
    ];
    const statuses: PatientInput["status"][] = ["active", "inactive", "active", "active"];
    const k = summarizeCaseload(rows.map((derived, i) => ({ status: statuses[i], derived })));
    expect(k.active).toBe(3);
    expect(k.noBaseline).toBe(1);
    expect(k.noScore).toBe(1);
    expect(k.worsening).toBe(1);
    expect(k.needsAttention).toBe(2);
    expect(k.improving).toBe(1);
    expect(k.graduationCandidates).toBe(1);
  });
});
