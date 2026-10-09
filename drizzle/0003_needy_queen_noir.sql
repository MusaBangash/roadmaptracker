CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"actor_id" text,
	"action" text NOT NULL,
	"subject_id" text,
	"detail" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip" text,
	"ok" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "assessment" DROP CONSTRAINT "assessment_assessor_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "invite" DROP CONSTRAINT "invite_created_by_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "item_progress" DROP CONSTRAINT "item_progress_reviewed_by_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "stage_signoff" DROP CONSTRAINT "stage_signoff_signed_by_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "assessment" ALTER COLUMN "assessor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invite" ALTER COLUMN "created_by_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "stage_signoff" ALTER COLUMN "signed_by_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "consent_at" timestamp;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_subject_id_user_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset" ADD CONSTRAINT "password_reset_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset" ADD CONSTRAINT "password_reset_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset" ADD CONSTRAINT "password_reset_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_org_time" ON "audit_log" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_actor" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "login_attempt_email_time" ON "login_attempt" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "login_attempt_ip_time" ON "login_attempt" USING btree ("ip","created_at");--> statement-breakpoint
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_assessor_id_user_id_fk" FOREIGN KEY ("assessor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_progress" ADD CONSTRAINT "item_progress_reviewed_by_id_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_signoff" ADD CONSTRAINT "stage_signoff_signed_by_id_user_id_fk" FOREIGN KEY ("signed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;