import { describe, expect, it } from "vitest";
import { combinedTrend, pickBaselineAndLatest, scaleTrend, summarizeScale } from "../trend";
import { DEFAULT_METRIC_SETTINGS, type AssessmentPoint } from "../types";

const pt = (
  overrides: Partial<AssessmentPoint> & { score: number; assessedAt: string },
): AssessmentPoint => ({
  id: `${overrides.scale ?? "phq9"}-${overrides.assessedAt}-${overrides.score}`,
  scale: "phq9",
  dateSource: "recorded",
  createdAt: `${overrides.assessedAt}T00:00:00.000Z`,
  ...overrides,
});

describe("pickBaselineAndLatest", () => {
  it("returns nulls for an empty history", () => {
    expect(pickBaselineAndLatest([])).toEqual({ baseline: null, latest: null });
  });
  it("uses the earliest date as baseline and the latest date as latest", () => {
    const a = pt({ score: 20, assessedAt: "2026-01-10" });
    const b = pt({ score: 12, assessedAt: "2026-03-01" });
    const c = pt({ score: 15, assessedAt: "2026-02-05" });
    expect(pickBaselineAndLatest([b, c, a])).toEqual({ baseline: a, latest: b });
  });
  it("breaks same-date ties by createdAt so an imported baseline stays first", () => {
    const baseline = pt({
      score: 22,
      assessedAt: "2026-09-20",
      createdAt: "2026-10-15T10:00:00.000Z",
      id: "base",
    });
    const latest = pt({
      score: 14,
      assessedAt: "2026-09-20",
      createdAt: "2026-10-15T10:00:01.000Z",
      id: "latest",
    });
    expect(pickBaselineAndLatest([latest, baseline])).toEqual({ baseline, latest });
  });
  it("single point is both baseline and latest", () => {
    const only = pt({ score: 9, assessedAt: "2026-05-01" });
    expect(pickBaselineAndLatest([only])).toEqual({ baseline: only, latest: only });
  });
});

describe("scaleTrend", () => {
  it("null delta → null", () => {
    expect(scaleTrend(null, 5)).toBeNull();
  });
  it.each([
    [-5, "improving"],
    [-6, "improving"],
    [-4, "stable"],
    [0, "stable"],
    [4, "stable"],
    [5, "worsening"],
    [9, "worsening"],
  ])("delta %i with threshold 5 → %s", (delta, expected) => {
    expect(scaleTrend(delta, 5)).toBe(expected);
  });
  it("honours a different threshold", () => {
    expect(scaleTrend(-4, 4)).toBe("improving");
    expect(scaleTrend(-3, 4)).toBe("stable");
  });
});

describe("combinedTrend", () => {
  it("no scores at all → null", () => {
    expect(combinedTrend(null, null, false)).toBeNull();
  });
  it("scores exist but no delta on either → first_score", () => {
    expect(combinedTrend(null, null, true)).toBe("first_score");
  });
  it("one improving and one worsening → mixed", () => {
    expect(combinedTrend("improving", "worsening", true)).toBe("mixed");
    expect(combinedTrend("worsening", "improving", true)).toBe("mixed");
  });
  it("any worsening (without improving) → worsening", () => {
    expect(combinedTrend("worsening", "stable", true)).toBe("worsening");
    expect(combinedTrend("stable", "worsening", true)).toBe("worsening");
    expect(combinedTrend("worsening", null, true)).toBe("worsening");
  });
  it("any improving (without worsening) → improving", () => {
    expect(combinedTrend("improving", "stable", true)).toBe("improving");
    expect(combinedTrend(null, "improving", true)).toBe("improving");
  });
  it("both stable → stable", () => {
    expect(combinedTrend("stable", "stable", true)).toBe("stable");
    expect(combinedTrend("stable", null, true)).toBe("stable");
  });
});

describe("summarizeScale", () => {
  it("computes delta baseline → latest and severity of latest", () => {
    const history = [
      pt({ score: 21, assessedAt: "2026-01-01" }),
      pt({ score: 18, assessedAt: "2026-02-01" }),
      pt({ score: 11, assessedAt: "2026-03-01" }),
    ];
    const s = summarizeScale("phq9", history, DEFAULT_METRIC_SETTINGS);
    expect(s.delta).toBe(-10);
    expect(s.trend).toBe("improving");
    expect(s.severity).toBe("moderate");
    expect(s.history.map((h) => h.score)).toEqual([21, 18, 11]);
  });
  it("single assessment → delta null, trend null", () => {
    const s = summarizeScale("gad7", [pt({ scale: "gad7", score: 16, assessedAt: "2026-01-01" })], DEFAULT_METRIC_SETTINGS);
    expect(s.delta).toBeNull();
    expect(s.trend).toBeNull();
    expect(s.severity).toBe("severe");
  });
  it("ignores points from the other scale", () => {
    const s = summarizeScale(
      "phq9",
      [pt({ scale: "gad7", score: 16, assessedAt: "2026-01-01" })],
      DEFAULT_METRIC_SETTINGS,
    );
    expect(s.latest).toBeNull();
    expect(s.severity).toBeNull();
  });
});
