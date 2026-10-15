CREATE TYPE "public"."goal_status" AS ENUM('open', 'achieved', 'dropped');--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" text,
	"target_date" date,
	"status" "goal_status" DEFAULT 'open' NOT NULL,
	"notes" text,
	"achieved_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_patient_status_idx" ON "goals" USING btree ("patient_id","status");--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN "treatment_goals";