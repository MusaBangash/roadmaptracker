ALTER TABLE "certificate_design" ADD COLUMN "online_image" "bytea";--> statement-breakpoint
ALTER TABLE "certificate_design" ADD COLUMN "online_mime" text;--> statement-breakpoint
ALTER TABLE "certificate_design" ADD COLUMN "online_updated_at" timestamp;