# Horizon Care Tracker — Business Rules & Code Reference

Horizon programme (Anxiety & Depression) · Alkalma · Al Falah and Al Bateen centers.
Reference for Care Coordination / Case Management and for developers.
Every rule lives in `src/lib/metrics/` as a pure function (no database access) and is covered by tests (`npm test`, 92 cases). The exact source of each rule is quoted at the end of its section. Spanish version: [REGLAS.md](./REGLAS.md).

---

## 1. Principles

1. **Every screening is kept.** Each PHQ-9 and GAD-7 is stored as its own dated row. Nothing is overwritten.
2. **Delta is always baseline → latest.** Consecutive scores are never compared; the first recorded score is compared with the most recent one.
3. **Everything derived is computed at read time.** Severity, trend, alerts and priority are never stored; they are recalculated with today's date and the current Settings.
4. **Only Enrolled patients generate work.** An Unenrolled patient triggers no rule and has priority 0.
5. **Exactly four alert rules.** Severity, "Improving" and "Graduation candidate" are information, not alerts.
6. **The app is the source of truth.** The Excel import ran once; every correction is made in the app.

---

## 2. Scales and validation

| Scale | Valid range | Date |
|---|---|---|
| PHQ-9 | 0 – 27 | Cannot be in the future |
| GAD-7 | 0 – 21 | Cannot be in the future |

An out-of-range score is rejected (in the app and in the import). Each score carries a `dateSource`: `recorded` (real date) or `estimated` (assumed date; editable on the patient page).

```ts
// src/lib/metrics/severity.ts
export const SCALE_MAX: Record<Scale, number> = { phq9: 27, gad7: 21 };

// src/lib/validation.ts
export const assessmentSchema = z
  .object({
    patientId: z.string().uuid(),
    scale: z.enum(["phq9", "gad7"]),
    score: z.coerce.number().int(),
    assessedAt: notFuture,
    dateSource: z.enum(["recorded", "estimated"]).default("recorded"),
    note: optionalText,
  })
  .superRefine((v, ctx) => {
    if (v.score < 0 || v.score > SCALE_MAX[v.scale]) {
      ctx.addIssue({ code: "custom", path: ["score"], message: "scoreRange" });
    }
  });
```

---

## 3. Baseline and latest score

- Scores of each scale are ordered by **assessment date**, then by **creation time** (tie-breaker for rows imported with the same date).
- **Baseline** = first in that order. **Latest** = last in that order.
- With a single score: baseline = latest, delta `null`, trend `first_score`.
- Editing a score's date re-orders the timeline and may change which row is the baseline.

```ts
// src/lib/metrics/trend.ts
export function sortChronologically(points: AssessmentPoint[]): AssessmentPoint[] {
  return [...points].sort((a, b) => {
    if (a.assessedAt !== b.assessedAt) return a.assessedAt < b.assessedAt ? -1 : 1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return 0;
  });
}

export function pickBaselineAndLatest(points: AssessmentPoint[]) {
  if (points.length === 0) return { baseline: null, latest: null };
  const sorted = sortChronologically(points);
  return { baseline: sorted[0], latest: sorted[sorted.length - 1] };
}
```

---

## 4. Severity

Computed on the **latest** score of each scale. There are no "tiers".

| PHQ-9 | Severity | GAD-7 | Severity |
|---|---|---|---|
| 0 – 4 | Minimal | 0 – 4 | Minimal |
| 5 – 9 | Mild | 5 – 9 | Mild |
| 10 – 14 | Moderate | 10 – 14 | Moderate |
| 15 – 19 | Moderately severe | 15+ | Severe |
| 20 – 27 | Severe | | |

- **Worst severity** of the patient = the higher of the two scales (order: minimal < mild < moderate < moderately severe < severe).
- **Severe range** = PHQ-9 ≥ 15 **or** GAD-7 ≥ 15. Shown as a badge to inform the clinician, but **not an alert**.

```ts
// src/lib/metrics/severity.ts
export function phqSeverity(score: number): Severity {
  if (score <= 4) return "minimal";
  if (score <= 9) return "mild";
  if (score <= 14) return "moderate";
  if (score <= 19) return "moderately_severe";
  return "severe";
}

export function gadSeverity(score: number): Severity {
  if (score <= 4) return "minimal";
  if (score <= 9) return "mild";
  if (score <= 14) return "moderate";
  return "severe";
}

export const SEVERITY_ORDER: Severity[] = ["minimal", "mild", "moderate", "moderately_severe", "severe"];
export const severityRank = (s: Severity): number => SEVERITY_ORDER.indexOf(s);

export function maxSeverity(...values: Array<Severity | null>): Severity | null {
  const present = values.filter((v): v is Severity => v !== null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => (severityRank(b) > severityRank(a) ? b : a));
}

export function isSevereRange(latestPhq: number | null, latestGad: number | null): boolean {
  const phq = latestPhq !== null ? phqSeverity(latestPhq) : null;
  const gad = latestGad !== null ? gadSeverity(latestGad) : null;
  return phq === "moderately_severe" || phq === "severe" || gad === "severe";
}
```

---

## 5. Delta and trend

- **Delta** = latest − baseline (per scale). Negative = improvement.
- **Change threshold** is configurable: PHQ-9 default **5**, GAD-7 default **4**.
- Per scale: `delta ≤ −threshold` → Improving · `delta ≥ +threshold` → Worsening · otherwise Stable.
- **Combined trend** of the patient:
  - One scale worsens and the other improves → `mixed` (treated as worsening for the alert).
  - Any scale worsens → `worsening`.
  - Any scale improves (and none worsens) → `improving`.
  - Both stable → `stable`.
  - Single score (no delta) → `first_score`.

```ts
// src/lib/metrics/trend.ts
export function scaleTrend(delta: number | null, threshold: number): ScaleTrend | null {
  if (delta === null) return null;
  if (delta <= -threshold) return "improving";
  if (delta >= threshold) return "worsening";
  return "stable";
}

export function combinedTrend(phq: ScaleTrend | null, gad: ScaleTrend | null, hasAnyScore: boolean): Trend | null {
  const trends = [phq, gad].filter((t): t is ScaleTrend => t !== null);
  if (trends.length === 0) return hasAnyScore ? "first_score" : null;
  const hasWorsening = trends.includes("worsening");
  const hasImproving = trends.includes("improving");
  if (hasWorsening && hasImproving) return "mixed";
  if (hasWorsening) return "worsening";
  if (hasImproving) return "improving";
  return "stable";
}

export function summarizeScale(scale: Scale, points: AssessmentPoint[], settings: MetricSettings): ScaleSummary {
  const history = sortChronologically(points.filter((p) => p.scale === scale));
  const { baseline, latest } = pickBaselineAndLatest(history);
  const delta = baseline && latest && history.length > 1 ? latest.score - baseline.score : null;
  return {
    scale, history, baseline, latest, delta,
    trend: scaleTrend(delta, thresholdFor(scale, settings)),
    severity: latest ? severityFor(scale, latest.score) : null,
  };
}
```

---

## 6. Screening cadence (next due)

- **Last score date** = the most recent of the latest PHQ-9 and the latest GAD-7.
- **Next due** = last score date + `checkIntervalMonths` (default **1 month**).
- **Days past due** = today − next due. Positive = overdue.
- Status: `no_scores` (no score at all) · `ok` (within the interval) · `overdue` (days past due > 0).
- **Recurring**: every new score restarts the clock. A patient with no new score becomes overdue again one interval after each screening.

```ts
// src/lib/metrics/alerts.ts
export function assessmentStatus(lastScoreDate: string | null, settings: MetricSettings, today: Date) {
  if (!lastScoreDate) return { status: "no_scores", nextDue: null, daysPastDue: null };
  const nextDue = addMonths(parseISO(lastScoreDate), settings.checkIntervalMonths);
  const daysPastDue = differenceInCalendarDays(today, nextDue);
  return { status: daysPastDue > 0 ? "overdue" : "ok", nextDue: toIsoDate(nextDue), daysPastDue };
}
```

---

## 7. Attendance (last session)

- **Days since last session** = today − `lastSessionDate`.
- Status: `unknown` (no session date) · `ok` · `concern` when the days exceed `attendanceConcernDays` (default **30**; currently 40 in production).
- Without a session date the session alert is not raised (there is nothing to evaluate).

```ts
// src/lib/metrics/alerts.ts
export function attendanceStatus(lastSessionDate: string | null, settings: MetricSettings, today: Date) {
  if (!lastSessionDate) return { status: "unknown", daysSince: null };
  const daysSince = differenceInCalendarDays(today, parseISO(lastSessionDate));
  return { status: daysSince > settings.attendanceConcernDays ? "concern" : "ok", daysSince };
}
```

---

## 8. The four alert rules

Apply to **Enrolled** patients only. A patient can have several at once.

| # | Rule | Key | Condition | Weight |
|---|---|---|---|---|
| 1 | **Worsening** | `worsening` | Combined trend `worsening` or `mixed` (baseline → latest rose ≥ threshold on any scale) | 40 |
| 2 | **No score > 1 month** | `no_score` | Screening status `overdue` (more than one interval since the last score) | 30 |
| 3 | **No session > 1 month** | `no_session` | Attendance status `concern` (more than N days without a session) | 30 |
| 4 | **No baseline** | `no_baseline` | Enrolled patient with no PHQ-9 / GAD-7 at all | 20 |

- **Needs attention** = at least one rule active.
- Chip display order: Worsening · No score · No session · No baseline.
- Rules 2 and 4 are mutually exclusive (no scores → cannot be overdue). Rules 1 and 4 too (no scores → no trend).

```ts
// src/lib/metrics/flags.ts
export const FLAG_ORDER: Flag[] = ["worsening", "no_score", "no_session", "no_baseline"];

export function computeFlags(input: FlagInput): Flag[] {
  // Only patients still in the programme generate work for the coordinator.
  if (input.patient.status !== "active") return [];

  const set = new Set<Flag>();
  if (input.trend === "worsening" || input.trend === "mixed") set.add("worsening");
  if (input.assessmentStatus === "overdue") set.add("no_score");
  if (input.attendanceStatus === "concern") set.add("no_session");
  if (input.assessmentStatus === "no_scores") set.add("no_baseline");

  return FLAG_ORDER.filter((f) => set.has(f));
}
```

---

## 9. Priority

**Priority = sum of the weights of the active rules + manual bonus + overdue tie-breaker.**

- Weights: Worsening 40 · No score 30 · No session 30 · No baseline 20.
- **Manual bonus**: if the coordinator set `Follow-up priority = High`, +20. Applies only when at least one rule is active (it is not an alert on its own).
- **Tie-breaker**: `min(daysPastDue, 90) / 100` → between 0.01 and 0.90. Between two patients with the same rules, the one overdue for longer floats up.
- No active rules → priority **0** (shown as "—"). Unenrolled patient → 0.
- Maximum possible: Worsening + No score + No session + High bonus + tie-breaker = 40 + 30 + 30 + 20 + 0.90 = **120.90** (No baseline cannot coexist with Worsening or No score).

**Examples (today 2026-10-22):**

| Patient | Rules | Manual High | Days past due | Priority |
|---|---|---|---|---|
| A | Worsening + No score | Yes | 45 | 40 + 30 + 20 + 0.45 = **90.45** |
| B | No score + No session | No | 12 | 30 + 30 + 0.12 = **60.12** |
| C | No baseline + No session | No | — | 20 + 30 = **50** |
| D | No score | No | 200 | 30 + 0.90 = **30.90** |
| E | None (severe range but on track) | Yes | — | **0** |

```ts
// src/lib/metrics/flags.ts
export const PRIORITY_WEIGHTS: Record<Flag, number> = {
  worsening: 40,
  no_score: 30,
  no_session: 30,
  no_baseline: 20,
};

/** Manual "High" follow-up priority set by the coordinator adds this on top. */
export const HIGH_PRIORITY_BONUS = 20;

export function priorityScore(
  flags: Flag[],
  daysPastDue: number | null,
  followUpPriority: PatientInput["followUpPriority"] = "routine",
): number {
  const base = flags.reduce((sum, f) => sum + PRIORITY_WEIGHTS[f], 0);
  if (base === 0) return 0;
  const manual = followUpPriority === "high" ? HIGH_PRIORITY_BONUS : 0;
  const overdueBonus = daysPastDue && daysPastDue > 0 ? Math.min(daysPastDue, 90) / 100 : 0;
  return Math.round((base + manual + overdueBonus) * 100) / 100;
}
```

Table tooltip (EN): *"Sum of the active rules: Worsening 40 · No score > 1 month 30 · No session > 1 month 30 · No baseline 20. Manual 'High' follow-up priority adds 20. Ties go to the longest overdue."*

---

## 10. Information that is NOT an alert

| Indicator | Definition | Where it appears |
|---|---|---|
| **Severity** | Band of the latest score (section 4) | Badge in the PHQ-9 / GAD-7 cell, filters |
| **Severe range** | PHQ-9 ≥ 15 or GAD-7 ≥ 15 | Badge, export column |
| **Improving** | Combined trend `improving` | "Improving" KPI (click filters the table) |
| **Graduation candidate** | Active patient whose latest scores are **all** < 5 (if only one scale exists, that one suffices) | "Graduation candidates" KPI (click filters) |
| **Manual priority** | Routine / Low / Mid / High, set by the coordinator | Filter; "High" adds +20 to priority |

```ts
// src/lib/metrics/derive.ts (excerpt)
graduationCandidate: patient.status === "active" && latest.length > 0 && latest.every((v) => v < 5),
```

---

## 11. Single entry point: `derivePatient`

Dashboard, patient page and export share the same function; there are no duplicated calculations.

```ts
// src/lib/metrics/derive.ts
export function derivePatient(patient: PatientInput, assessments: AssessmentPoint[], settings: MetricSettings, today: Date): PatientDerived {
  const phq = summarizeScale("phq9", assessments, settings);
  const gad = summarizeScale("gad7", assessments, settings);

  const latestPhq = phq.latest?.score ?? null;
  const latestGad = gad.latest?.score ?? null;
  const trend = combinedTrend(phq.trend, gad.trend, assessments.length > 0);

  const lastScoreDate =
    [phq.latest?.assessedAt, gad.latest?.assessedAt].filter((d): d is string => !!d).sort().at(-1) ?? null;

  const assessment = assessmentStatus(lastScoreDate, settings, today);
  const attendance = attendanceStatus(patient.lastSessionDate, settings, today);

  const flags = computeFlags({ patient, trend, assessmentStatus: assessment.status, attendanceStatus: attendance.status });

  const latest = [latestPhq, latestGad].filter((v): v is number => v !== null);

  return {
    phq, gad,
    maxSeverity: maxSeverity(phq.severity, gad.severity),
    severeRange: isSevereRange(latestPhq, latestGad),
    graduationCandidate: patient.status === "active" && latest.length > 0 && latest.every((v) => v < 5),
    trend,
    lastScoreDate,
    nextDueDate: assessment.nextDue,
    assessmentStatus: assessment.status,
    daysPastDue: assessment.daysPastDue,
    attendanceStatus: attendance.status,
    daysSinceSession: attendance.daysSince,
    flags,
    needsAttention: flags.length > 0,
    priorityScore: priorityScore(flags, assessment.daysPastDue, patient.followUpPriority),
  };
}
```

---

## 12. Dashboard KPIs

All count **Enrolled patients only** in the selected center (or both).

| KPI | Counts |
|---|---|
| Enrolled | status = active (enrolled) |
| Needs attention | ≥ 1 active rule |
| Worsening | rule `worsening` |
| No score > 1 month | rule `no_score` |
| No session > 1 month | rule `no_session` |
| No baseline | rule `no_baseline` |
| Improving | trend `improving` |
| Graduation candidates | `graduationCandidate` |

```ts
// src/lib/metrics/derive.ts
export function summarizeCaseload(rows: Array<{ status: PatientInput["status"]; derived: PatientDerived }>): CaseloadKpis {
  const active = rows.filter((r) => r.status === "active");
  const has = (flag: Flag) => active.filter((r) => r.derived.flags.includes(flag)).length;
  return {
    total: rows.length,
    active: active.length,
    needsAttention: active.filter((r) => r.derived.needsAttention).length,
    worsening: has("worsening"),
    noScore: has("no_score"),
    noSession: has("no_session"),
    noBaseline: has("no_baseline"),
    improving: active.filter((r) => r.derived.trend === "improving").length,
    graduationCandidates: active.filter((r) => r.derived.graduationCandidate).length,
  };
}
```

---

## 13. Table filters and sorting

- **Center scope**: cookie `horizon_center` = `all | al_falah | al_bateen`.
- **Filters** (URL parameters, shareable): search `q` (MRN, name, diagnosis, psychiatrist, psychologist) · alert (`needs_attention | worsening | no_score | no_session | no_baseline`) · PHQ severity · GAD severity · clinician · manual priority · status (`active` = Enrolled by default, `inactive` = Unenrolled, `all`). Hidden but reachable from the KPIs: `trend=improving`, `graduation=1`.
- **Sort by header**: priority (desc by default), MRN (asc), latest PHQ-9 (desc), latest GAD-7 (desc), last score (asc = oldest first), last session (asc).
- **Tie-breaker**: always priority descending, then numeric MRN.
- Missing scores sort as −∞ (they land at the bottom in descending order).

```ts
// src/lib/filters.ts (excerpt)
export const DEFAULT_DIR: Record<SortKey, SortDir> = {
  priority: "desc", mrn: "asc", phq: "desc", gad: "desc", last_score: "asc", last_session: "asc",
};
// ...
if (c === 0) c = b.derived.priorityScore - a.derived.priorityScore || a.patient.mrn.localeCompare(b.patient.mrn, undefined, { numeric: true });
```

---

## 14. Configurable parameters (Settings → Clinical rules)

| Parameter | Default | Allowed range | Affects |
|---|---|---|---|
| PHQ-9 change threshold | 5 | 1 – 27 | Trend / Worsening rule |
| GAD-7 change threshold | 4 | 1 – 21 | Trend / Worsening rule |
| Screening interval (months) | 1 | 1 – 12 | Next due / No score rule |
| Days without session for alert | 30 | 1 – 365 | No session rule |

A change applies immediately to every patient (nothing is pre-computed).

```ts
// src/db/schema.ts
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  phqChangeThreshold: integer("phq_change_threshold").notNull().default(5),
  gadChangeThreshold: integer("gad_change_threshold").notNull().default(4),
  checkIntervalMonths: integer("check_interval_months").notNull().default(1),
  attendanceConcernDays: integer("attendance_concern_days").notNull().default(30),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// src/lib/validation.ts
export const settingsSchema = z.object({
  phqChangeThreshold: z.coerce.number().int().min(1).max(27),
  gadChangeThreshold: z.coerce.number().int().min(1).max(21),
  checkIntervalMonths: z.coerce.number().int().min(1).max(12),
  attendanceConcernDays: z.coerce.number().int().min(1).max(365),
});
```

---

## 15. Catalogues (Settings)

Patient forms only accept catalogue values; **there is no "Other"**. If a patient holds a value that is no longer in the catalogue, the form marks it with ⚠ and drops it on save.

| Catalogue | Fields | Used for |
|---|---|---|
| Clinicians | name (unique), specialty (psychiatrist / psychologist / …), optional center, active | Patient's psychiatrist and psychologist, clinician filter |
| Diagnoses | label, active | Diagnosis field (multi-select) |
| Care plan options | label, active | Medical care plan field (Medication · Referred to psychology · Psychotherapy) |
| Goal categories | label, active | Individual goals |

| Unenrolment reasons | label, active | Mandatory reason when a patient leaves the programme |

Patient data: unique key `(center, MRN)`.

---

## 15b. Enrolment and unenrolment

- Every patient is either **Enrolled** or **Unenrolled** (stored as `active` / `inactive`).
- Creating a patient records an **enrolment date** (defaults to today, editable, never in the future). Imported patients received the date of their first score, or the import date when they had none.
- **Unenrolling** requires an **unenrolment date** (not before the enrolment date, not in the future) and a **reason** from the catalogue. The patient page has an "Unenrol patient" form; the edit form enforces the same rule when the status is switched.
- Unenrolled patients raise no alerts, have priority 0, are excluded from every KPI and leave the default table (status filter: Enrolled by default · Unenrolled · All).
- **Re-enrolling** sets today as the new enrolment date and clears the unenrolment date and reason.
- **Sessions** are recorded as psychology sessions and psychiatry sessions; the total is always their sum. Existing patients received a random split of their imported total (demo data).

```ts
// src/lib/validation.ts
export const patientSchema = patientBaseSchema
  .superRefine((v, ctx) => {
    if (v.status !== "inactive") return;
    if (!v.unenrolledAt) ctx.addIssue({ code: "custom", path: ["unenrolledAt"], message: "unenrolledAtRequired" });
    else if (v.unenrolledAt < v.enrolledAt) ctx.addIssue({ code: "custom", path: ["unenrolledAt"], message: "unenrolledBeforeEnrolled" });
    if (!v.unenrollReason) ctx.addIssue({ code: "custom", path: ["unenrollReason"], message: "unenrollReasonRequired" });
  })
  .transform((v) => {
    const sessionsCount = v.psychologySessions === null && v.psychiatrySessions === null ? null : (v.psychologySessions ?? 0) + (v.psychiatrySessions ?? 0);
    return v.status === "active" ? { ...v, sessionsCount, unenrolledAt: null, unenrollReason: null } : { ...v, sessionsCount };
  });
```

---

## 16. Individual goals (separate from the medical care plan)

- The **care plan** is the medical field that came from the Excel files (catalogue).
- **Goals** are individual objectives per patient: title, category (catalogue), target date, notes.
- States: `open` → `achieved` (stores the achievement date) or `dropped`. Goals can be reopened and deleted.
- An open goal whose target date has passed is highlighted in amber. No limit on the number of goals.

---

## 17. Excel import rules (one-time)

Only the anonymized sheets are read: Al Falah `September 26` and Al Bateen `Register`. The other Al Bateen sheets contain real data and are never read. The `data/` folder is excluded from the repository.

**Score dates (agreed: baseline and latest share a date until corrected in the app):**

| Case | Assigned date | `dateSource` |
|---|---|---|
| Al Falah, baseline + latest | Both on `Last test` | baseline `estimated`, latest `recorded` |
| Al Falah, baseline only | `Last test` (or `Last session` if missing) | `recorded` / `estimated` |
| Al Bateen, with `Last score date` | Both on that date | first `estimated`, latest `recorded` |
| Al Bateen, no date but `Next check due` | `Next check due − interval` | all `estimated` |
| Al Bateen, no scores | Nothing → the patient falls under **No baseline** | — |
| Out-of-range score (e.g. GAD 29) | Skipped; an import note records the anomaly | — |

- The baseline is inserted first so that `created_at` ordering holds when dates coincide.
- Excel-derived columns (trend, severity, next due, follow-up reason) are **not** imported as data; they are kept as one provenance note per patient.
- Clinicians: `"Dr. X, Name"` → psychiatrist `Dr. X`, psychologist `Name`; normalizes `Dr.X` → `Dr. X` and fixes known typos.
- Care plan: `meds*` → Medication · `refer*` → Referred to psychology · `psychotherapy/cbt` → Psychotherapy.
- Re-running is idempotent on `(center, MRN)`.

Code: `src/lib/import/alFalah.ts`, `src/lib/import/alBateen.ts`, `src/lib/import/normalize.ts`, `scripts/import-excel.ts`.

---

## 18. Export

`GET /api/export?format=csv|xlsx` returns the currently filtered table with derived columns: baseline / latest / delta / severity per scale, trend, last score, next due, days past due, last session, alerts, priority, graduation candidate, worst severity, severe range, enrolment / unenrolment dates and reason, psychology / psychiatry / total sessions.

---

## 19. Access and privacy

- Single admin login (`ADMIN_USERNAME` / `ADMIN_PASSWORD` environment variables). HS256 JWT session in the `horizon_session` cookie (12 h, httpOnly). Constant-time password comparison.
- Every page and action requires a session (`proxy.ts` + `requireSession()`).
- Note bodies are never written to logs.
- Languages: EN / ES / AR (RTL) via the `horizon_locale` cookie.

---

## 20. Reference types

```ts
// src/lib/metrics/types.ts
export type Severity = "minimal" | "mild" | "moderate" | "moderately_severe" | "severe";
export type ScaleTrend = "improving" | "stable" | "worsening";
export type Trend = ScaleTrend | "mixed" | "first_score";
export type AssessmentStatus = "no_scores" | "ok" | "overdue";
export type AttendanceStatus = "ok" | "concern" | "unknown";
export type Flag = "worsening" | "no_score" | "no_session" | "no_baseline";

export type MetricSettings = {
  phqChangeThreshold: number;
  gadChangeThreshold: number;
  checkIntervalMonths: number;
  attendanceConcernDays: number;
};

export const DEFAULT_METRIC_SETTINGS: MetricSettings = {
  phqChangeThreshold: 5,
  gadChangeThreshold: 4,
  checkIntervalMonths: 1,
  attendanceConcernDays: 30,
};

export type PatientDerived = {
  phq: ScaleSummary;
  gad: ScaleSummary;
  maxSeverity: Severity | null;
  severeRange: boolean;
  graduationCandidate: boolean;
  trend: Trend | null;
  lastScoreDate: string | null;
  nextDueDate: string | null;
  assessmentStatus: AssessmentStatus;
  daysPastDue: number | null;
  attendanceStatus: AttendanceStatus;
  daysSinceSession: number | null;
  flags: Flag[];
  needsAttention: boolean;
  priorityScore: number;
};
```

---

## File map

| Rule | File |
|---|---|
| Severity, severe range, scale maxima | `src/lib/metrics/severity.ts` |
| Chronological order, baseline/latest, delta, trend | `src/lib/metrics/trend.ts` |
| Screening due date, attendance | `src/lib/metrics/alerts.ts` |
| Four rules, weights, priority | `src/lib/metrics/flags.ts` |
| Per-patient derivation, KPIs | `src/lib/metrics/derive.ts` |
| Types and defaults | `src/lib/metrics/types.ts` |
| Form validation | `src/lib/validation.ts` |
| Table filters and sorting | `src/lib/filters.ts` |
| Parameters (`settings` table) | `src/db/schema.ts` |
| Excel import | `src/lib/import/*`, `scripts/import-excel.ts` |
| Tests | `src/lib/metrics/__tests__/`, `src/lib/import/__tests__/` |
