import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const centerEnum = pgEnum("center", ["al_falah", "al_bateen"]);
export const genderEnum = pgEnum("gender", ["male", "female", "unknown"]);
export const patientStatusEnum = pgEnum("patient_status", [
  "active",
  "inactive",
  "graduated",
  "transferred",
]);
export const scaleEnum = pgEnum("scale", ["phq9", "gad7"]);
export const dateSourceEnum = pgEnum("date_source", ["recorded", "estimated"]);
export const attendancePatternEnum = pgEnum("attendance_pattern", [
  "consistent",
  "irregular",
  "not_attending",
  "too_early",
]);
export const followUpPriorityEnum = pgEnum("follow_up_priority", [
  "routine",
  "low",
  "mid",
  "high",
]);
export const yesNoUnknownEnum = pgEnum("yes_no_unknown", ["yes", "no", "unknown"]);
export const noteKindEnum = pgEnum("note_kind", ["note", "action", "mdt", "import"]);

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    center: centerEnum("center").notNull(),
    mrn: text("mrn").notNull(),
    displayName: text("display_name"),
    age: integer("age"),
    gender: genderEnum("gender").notNull().default("unknown"),
    status: patientStatusEnum("status").notNull().default("active"),

    diagnosis: text("diagnosis"),
    carePlan: text("care_plan"),
    therapyProgress: text("therapy_progress"),
    treatmentGoals: text("treatment_goals"),

    psychiatrist: text("psychiatrist"),
    psychologist: text("psychologist"),

    medication: yesNoUnknownEnum("medication").notNull().default("unknown"),
    medicationAdherence: text("medication_adherence"),

    sessionsCount: integer("sessions_count"),
    attendancePct: numeric("attendance_pct", { precision: 5, scale: 2 }),
    attendancePattern: attendancePatternEnum("attendance_pattern"),
    lastSessionDate: date("last_session_date"),
    reasonNotAttending: text("reason_not_attending"),
    isHorizonPatient: boolean("is_horizon_patient"),

    followUpPriority: followUpPriorityEnum("follow_up_priority").notNull().default("routine"),
    ccAction: text("cc_action"),
    outcome: text("outcome"),
    initialSeverityLabel: text("initial_severity_label"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("patients_center_mrn_idx").on(t.center, t.mrn),
    index("patients_center_status_idx").on(t.center, t.status),
  ],
);

export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    scale: scaleEnum("scale").notNull(),
    score: smallint("score").notNull(),
    assessedAt: date("assessed_at").notNull(),
    dateSource: dateSourceEnum("date_source").notNull().default("recorded"),
    source: text("source").notNull().default("manual"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("assessments_patient_scale_date_idx").on(t.patientId, t.scale, t.assessedAt),
    check(
      "assessments_score_range",
      sql`(${t.scale} = 'phq9' AND ${t.score} BETWEEN 0 AND 27) OR (${t.scale} = 'gad7' AND ${t.score} BETWEEN 0 AND 21)`,
    ),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    kind: noteKindEnum("kind").notNull().default("note"),
    body: text("body").notNull(),
    author: text("author"),
    occurredAt: date("occurred_at").notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notes_patient_created_idx").on(t.patientId, t.createdAt)],
);

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  phqChangeThreshold: integer("phq_change_threshold").notNull().default(5),
  gadChangeThreshold: integer("gad_change_threshold").notNull().default(4),
  checkIntervalMonths: integer("check_interval_months").notNull().default(1),
  dueSoonDays: integer("due_soon_days").notNull().default(7),
  confirmActiveDays: integer("confirm_active_days").notNull().default(60),
  attendanceConcernDays: integer("attendance_concern_days").notNull().default(30),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
export type Assessment = typeof assessments.$inferSelect;
export type NewAssessment = typeof assessments.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Settings = typeof settings.$inferSelect;

export type Center = Patient["center"];
export type Scale = Assessment["scale"];
export type PatientStatus = Patient["status"];
export type FollowUpPriority = Patient["followUpPriority"];
