CREATE TYPE "public"."attendance_status" AS ENUM('PRESENT', 'ABSENT', 'LATE', 'LEAVE');--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "status" "attendance_status";--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "marked_by_id" text;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "marked_at" timestamp;--> statement-breakpoint
ALTER TABLE "cohort" ADD COLUMN "class_days" jsonb;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_id_user_id_fk" FOREIGN KEY ("marked_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Existing marks: present = PRESENT, not present = ABSENT.
UPDATE "attendance" SET "status" = CASE WHEN "present" THEN 'PRESENT'::"attendance_status" ELSE 'ABSENT'::"attendance_status" END;