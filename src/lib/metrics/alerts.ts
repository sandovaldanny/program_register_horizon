import { addMonths, differenceInCalendarDays, formatISO, parseISO } from "date-fns";
import type { AssessmentStatus, AttendanceStatus, MetricSettings } from "./types";

export const toIsoDate = (d: Date): string => formatISO(d, { representation: "date" });

/**
 * Monthly screening cadence. `nextDue = lastScoreDate + checkIntervalMonths`.
 * Every time a new score is logged the clock restarts, so a patient with no
 * new score re-enters "overdue" one month after each screening.
 */
export function assessmentStatus(
  lastScoreDate: string | null,
  settings: MetricSettings,
  today: Date,
): { status: AssessmentStatus; nextDue: string | null; daysPastDue: number | null } {
  if (!lastScoreDate) return { status: "no_scores", nextDue: null, daysPastDue: null };

  const nextDue = addMonths(parseISO(lastScoreDate), settings.checkIntervalMonths);
  const daysPastDue = differenceInCalendarDays(today, nextDue);

  let status: AssessmentStatus;
  if (daysPastDue > settings.confirmActiveDays) status = "confirm_active";
  else if (daysPastDue > 0) status = "overdue";
  else if (daysPastDue >= -settings.dueSoonDays) status = "due_soon";
  else status = "ok";

  return { status, nextDue: toIsoDate(nextDue), daysPastDue };
}

export function attendanceStatus(
  lastSessionDate: string | null,
  settings: MetricSettings,
  today: Date,
): { status: AttendanceStatus; daysSince: number | null } {
  if (!lastSessionDate) return { status: "unknown", daysSince: null };
  const daysSince = differenceInCalendarDays(today, parseISO(lastSessionDate));
  return { status: daysSince > settings.attendanceConcernDays ? "concern" : "ok", daysSince };
}
