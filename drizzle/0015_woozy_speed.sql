CREATE TYPE "public"."residence" AS ENUM('HOSTEL', 'DAY');--> statement-breakpoint
CREATE TABLE "class_group" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cohort" ADD COLUMN "group_id" text;--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "residence" "residence";--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "has_hostel" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "class_group" ADD CONSTRAINT "class_group_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "class_group_org_name" ON "class_group" USING btree ("org_id","name");--> statement-breakpoint
ALTER TABLE "cohort" ADD CONSTRAINT "cohort_group_id_class_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."class_group"("id") ON DELETE set null ON UPDATE no action;