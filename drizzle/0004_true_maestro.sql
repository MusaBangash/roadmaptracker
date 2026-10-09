CREATE TABLE "certificate" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"enrollment_id" text NOT NULL,
	"org_id" text NOT NULL,
	"name_on_certificate" text NOT NULL,
	"track_title" text NOT NULL,
	"track_edition" text DEFAULT '' NOT NULL,
	"school_name" text NOT NULL,
	"cohort_name" text NOT NULL,
	"completed_on" date NOT NULL,
	"issued_by_id" text,
	"issued_by_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"revoked_by_id" text,
	"revoke_reason" text,
	CONSTRAINT "certificate_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_issued_by_id_user_id_fk" FOREIGN KEY ("issued_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_revoked_by_id_user_id_fk" FOREIGN KEY ("revoked_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certificate_enrollment" ON "certificate" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "certificate_one_valid" ON "certificate" USING btree ("enrollment_id") WHERE "revoked_at" is null;