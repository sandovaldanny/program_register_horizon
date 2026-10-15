import { describe, expect, it } from "vitest";
import { assessmentStatus, attendanceStatus } from "../alerts";
import { DEFAULT_METRIC_SETTINGS } from "../types";

const S = DEFAULT_METRIC_SETTINGS;
const d = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("assessmentStatus", () => {
  it("no last score → no_scores", () => {
    expect(assessmentStatus(null, S, d("2026-10-15"))).toEqual({
      status: "no_scores",
      nextDue: null,
      daysPastDue: null,
    });
  });
  it("before next due → ok, with the due date and negative days", () => {
    const r = assessmentStatus("2026-10-01", S, d("2026-10-15"));
    expect(r.status).toBe("ok");
    expect(r.nextDue).toBe("2026-11-01");
    expect(r.daysPastDue).toBe(-17);
  });
  it("on the due date → ok, the day after → overdue", () => {
    expect(assessmentStatus("2026-09-15", S, d("2026-10-15")).status).toBe("ok");
    const r = assessmentStatus("2026-09-15", S, d("2026-10-16"));
    expect(r.status).toBe("overdue");
    expect(r.daysPastDue).toBe(1);
  });
  it("re-raises every month: a new score restarts the clock", () => {
    expect(assessmentStatus("2026-08-01", S, d("2026-10-15")).status).toBe("overdue");
    expect(assessmentStatus("2026-10-10", S, d("2026-10-15")).status).toBe("ok");
  });
  it("respects a 2-month interval", () => {
    const r = assessmentStatus("2026-08-01", { ...S, checkIntervalMonths: 2 }, d("2026-09-15"));
    expect(r.status).toBe("ok");
    expect(r.nextDue).toBe("2026-10-01");
  });
  it("handles month-end clamping (Jan 31 + 1 month = Feb 28)", () => {
    expect(assessmentStatus("2026-01-31", S, d("2026-02-15")).nextDue).toBe("2026-02-28");
  });
});

describe("attendanceStatus", () => {
  it("unknown when there is no session date", () => {
    expect(attendanceStatus(null, S, d("2026-10-15"))).toEqual({ status: "unknown", daysSince: null });
  });
  it("ok within the window, concern beyond it", () => {
    expect(attendanceStatus("2026-09-15", S, d("2026-10-15"))).toEqual({ status: "ok", daysSince: 30 });
    expect(attendanceStatus("2026-09-14", S, d("2026-10-15"))).toEqual({ status: "concern", daysSince: 31 });
  });
});
