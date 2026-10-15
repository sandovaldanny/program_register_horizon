CREATE TYPE "public"."specialty" AS ENUM('psychiatrist', 'psychologist', 'other');--> statement-breakpoint
CREATE TABLE "clinicians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"specialty" "specialty" NOT NULL,
	"center" "center",
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "clinicians_name_idx" ON "clinicians" USING btree ("name");