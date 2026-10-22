ALTER TABLE "patients" ADD COLUMN "enrolled_at" date DEFAULT CURRENT_DATE NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "unenrolled_at" date;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "unenroll_reason" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "psychology_sessions" integer;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "psychiatry_sessions" integer;--> statement-breakpoint
UPDATE "patients" p SET "enrolled_at" = COALESCE((SELECT min(a."assessed_at") FROM "assessments" a WHERE a."patient_id" = p."id"), p."created_at"::date);--> statement-breakpoint
UPDATE "patients" SET "psychology_sessions" = floor(random() * ("sessions_count" + 1))::int WHERE "sessions_count" IS NOT NULL;--> statement-breakpoint
UPDATE "patients" SET "psychiatry_sessions" = "sessions_count" - "psychology_sessions" WHERE "sessions_count" IS NOT NULL;--> statement-breakpoint
UPDATE "patients" SET "psychology_sessions" = floor(random() * 9)::int, "psychiatry_sessions" = floor(random() * 5)::int WHERE "sessions_count" IS NULL;--> statement-breakpoint
UPDATE "patients" SET "sessions_count" = "psychology_sessions" + "psychiatry_sessions";--> statement-breakpoint
INSERT INTO "catalog_items" ("kind", "label") VALUES
  ('unenroll_reason', 'Patient completed the programme successfully'),
  ('unenroll_reason', 'Patient decided not to continue'),
  ('unenroll_reason', 'No insurance')
ON CONFLICT DO NOTHING;
