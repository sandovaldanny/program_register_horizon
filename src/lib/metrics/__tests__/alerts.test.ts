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
  it("well before next due → ok", () => {
    const r = assessmentStatus("2026-10-01", S, d("2026-10-15"));
    expect(r.status).toBe("ok");
    expect(r.nextDue).toBe("2026-11-01");
    expect(r.daysPastDue).toBe(-17);
  });
  it("inside the due-soon window → due_soon (7 days before)", () => {
    expect(assessmentStatus("2026-09-15", S, d("2026-10-08")).status).toBe("due_soon");
    expect(assessmentStatus("2026-09-15", S, d("2026-10-07")).status).toBe("ok");
  });
  it("on the due date itself → due_soon, the day after → overdue", () => {
    expect(assessmentStatus("2026-09-15", S, d("2026-10-15")).status).toBe("due_soon");
    const r = assessmentStatus("2026-09-15", S, d("2026-10-16"));
    expect(r.status).toBe("overdue");
    expect(r.daysPastDue).toBe(1);
  });
  it("more than confirmActiveDays past due → confirm_active", () => {
    // next due = 2026-07-01; 60 days past due is still "overdue", 61 is "confirm_active"
    expect(assessmentStatus("2026-06-01", S, d("2026-08-30")).status).toBe("overdue");
    expect(assessmentStatus("2026-06-01", S, d("2026-08-31")).status).toBe("confirm_active");
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
