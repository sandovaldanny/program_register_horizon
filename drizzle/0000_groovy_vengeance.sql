CREATE TYPE "public"."attendance_pattern" AS ENUM('consistent', 'irregular', 'not_attending', 'too_early');--> statement-breakpoint
CREATE TYPE "public"."center" AS ENUM('al_falah', 'al_bateen');--> statement-breakpoint
CREATE TYPE "public"."date_source" AS ENUM('recorded', 'estimated');--> statement-breakpoint
CREATE TYPE "public"."follow_up_priority" AS ENUM('routine', 'low', 'mid', 'high');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."note_kind" AS ENUM('note', 'action', 'mdt', 'import');--> statement-breakpoint
CREATE TYPE "public"."patient_status" AS ENUM('active', 'inactive', 'graduated', 'transferred');--> statement-breakpoint
CREATE TYPE "public"."scale" AS ENUM('phq9', 'gad7');--> statement-breakpoint
CREATE TYPE "public"."yes_no_unknown" AS ENUM('yes', 'no', 'unknown');--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"scale" "scale" NOT NULL,
	"score" smallint NOT NULL,
	"assessed_at" date NOT NULL,
	"date_source" date_source DEFAULT 'recorded' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessments_score_range" CHECK (("assessments"."scale" = 'phq9' AND "assessments"."score" BETWEEN 0 AND 27) OR ("assessments"."scale" = 'gad7' AND "assessments"."score" BETWEEN 0 AND 21))
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"kind" "note_kind" DEFAULT 'note' NOT NULL,
	"body" text NOT NULL,
	"author" text,
	"occurred_at" date DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"center" "center" NOT NULL,
	"mrn" text NOT NULL,
	"display_name" text,
	"age" integer,
	"gender" "gender" DEFAULT 'unknown' NOT NULL,
	"status" "patient_status" DEFAULT 'active' NOT NULL,
	"diagnosis" text,
	"care_plan" text,
	"therapy_progress" text,
	"treatment_goals" text,
	"psychiatrist" text,
	"psychologist" text,
	"medication" "yes_no_unknown" DEFAULT 'unknown' NOT NULL,
	"medication_adherence" text,
	"sessions_count" integer,
	"attendance_pct" numeric(5, 2),
	"attendance_pattern" "attendance_pattern",
	"last_session_date" date,
	"reason_not_attending" text,
	"is_horizon_patient" boolean,
	"follow_up_priority" "follow_up_priority" DEFAULT 'routine' NOT NULL,
	"cc_action" text,
	"outcome" text,
	"initial_severity_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"phq_change_threshold" integer DEFAULT 5 NOT NULL,
	"gad_change_threshold" integer DEFAULT 4 NOT NULL,
	"check_interval_months" integer DEFAULT 1 NOT NULL,
	"due_soon_days" integer DEFAULT 7 NOT NULL,
	"confirm_active_days" integer DEFAULT 60 NOT NULL,
	"attendance_concern_days" integer DEFAULT 30 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessments_patient_scale_date_idx" ON "assessments" USING btree ("patient_id","scale","assessed_at");--> statement-breakpoint
CREATE INDEX "notes_patient_created_idx" ON "notes" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_center_mrn_idx" ON "patients" USING btree ("center","mrn");--> statement-breakpoint
CREATE INDEX "patients_center_status_idx" ON "patients" USING btree ("center","status");