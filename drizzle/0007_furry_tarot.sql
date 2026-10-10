CREATE TABLE "certificate_design" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"image" "bytea" NOT NULL,
	"mime" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"layout" jsonb NOT NULL,
	"current" boolean DEFAULT true NOT NULL,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "design_id" text;--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "layout" jsonb;--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "reg_no" text;--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "course_title" text;--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "duration" text;--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "session" text;--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "level" text;--> statement-breakpoint
ALTER TABLE "cohort" ADD COLUMN "cert_defaults" jsonb;--> statement-breakpoint
ALTER TABLE "certificate_design" ADD CONSTRAINT "certificate_design_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_design" ADD CONSTRAINT "certificate_design_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certificate_design_org" ON "certificate_design" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "certificate_design_current" ON "certificate_design" USING btree ("org_id") WHERE "current";--> statement-breakpoint
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_design_id_certificate_design_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."certificate_design"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "certificate_reg_no" ON "certificate" USING btree ("org_id",upper("reg_no")) WHERE "reg_no" is not null and "revoked_at" is null;