CREATE TYPE "public"."enrollment_status" AS ENUM('ACTIVE', 'PAUSED', 'COMPLETED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."item_kind" AS ENUM('LESSON', 'PROJECT', 'DELIVERABLE', 'MILESTONE');--> statement-breakpoint
CREATE TYPE "public"."progress_status" AS ENUM('DONE', 'VERIFIED', 'NEEDS_WORK');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'INSTRUCTOR', 'STUDENT');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "assessment" (
	"id" text PRIMARY KEY NOT NULL,
	"enrollment_id" text NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"average" real,
	"passed" boolean,
	"notes" text,
	"assessor_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" text PRIMARY KEY NOT NULL,
	"enrollment_id" text NOT NULL,
	"date" date NOT NULL,
	"present" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cohort_instructor" (
	"cohort_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "cohort_instructor_cohort_id_user_id_pk" PRIMARY KEY("cohort_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "cohort" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"track_id" text NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollment" (
	"id" text PRIMARY KEY NOT NULL,
	"cohort_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" "enrollment_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"org_id" text NOT NULL,
	"role" "role" NOT NULL,
	"cohort_id" text,
	"max_uses" integer DEFAULT 50 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invite_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "item_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"enrollment_id" text NOT NULL,
	"item_id" text NOT NULL,
	"status" "progress_status" DEFAULT 'DONE' NOT NULL,
	"evidence_url" text,
	"note" text,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_by_id" text,
	"reviewed_at" timestamp,
	"review_note" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item" (
	"id" text PRIMARY KEY NOT NULL,
	"stage_id" text NOT NULL,
	"key" text NOT NULL,
	"order" integer NOT NULL,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"kind" "item_kind" DEFAULT 'LESSON' NOT NULL,
	"group" text,
	"optional" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text NOT NULL,
	"role" "role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_track" (
	"org_id" text NOT NULL,
	"track_id" text NOT NULL,
	CONSTRAINT "org_track_org_id_track_id_pk" PRIMARY KEY("org_id","track_id")
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_signoff" (
	"id" text PRIMARY KEY NOT NULL,
	"enrollment_id" text NOT NULL,
	"stage_id" text NOT NULL,
	"passed" boolean NOT NULL,
	"notes" text,
	"signed_by_id" text NOT NULL,
	"signed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage" (
	"id" text PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"key" text NOT NULL,
	"order" integer NOT NULL,
	"title" text NOT NULL,
	"level" text DEFAULT '' NOT NULL,
	"weeks" integer DEFAULT 0 NOT NULL,
	"benchmark" text DEFAULT '' NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"done_when" text DEFAULT '' NOT NULL,
	"resources" text DEFAULT '' NOT NULL,
	"optional" boolean DEFAULT false NOT NULL,
	"choice_group" text,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'ROLE' NOT NULL,
	"edition" text DEFAULT '' NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"expert" text DEFAULT '' NOT NULL,
	"benchmarks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rubric" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "track_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	"password_hash" text,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "weekly_log" (
	"id" text PRIMARY KEY NOT NULL,
	"enrollment_id" text NOT NULL,
	"week_start" date NOT NULL,
	"hours" real DEFAULT 0 NOT NULL,
	"finished" text DEFAULT '' NOT NULL,
	"stuck" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_assessor_id_user_id_fk" FOREIGN KEY ("assessor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_instructor" ADD CONSTRAINT "cohort_instructor_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_instructor" ADD CONSTRAINT "cohort_instructor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort" ADD CONSTRAINT "cohort_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort" ADD CONSTRAINT "cohort_track_id_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."track"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_progress" ADD CONSTRAINT "item_progress_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_progress" ADD CONSTRAINT "item_progress_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_progress" ADD CONSTRAINT "item_progress_reviewed_by_id_user_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_stage_id_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_track" ADD CONSTRAINT "org_track_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_track" ADD CONSTRAINT "org_track_track_id_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."track"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_signoff" ADD CONSTRAINT "stage_signoff_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_signoff" ADD CONSTRAINT "stage_signoff_stage_id_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_signoff" ADD CONSTRAINT "stage_signoff_signed_by_id_user_id_fk" FOREIGN KEY ("signed_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage" ADD CONSTRAINT "stage_track_id_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."track"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_log" ADD CONSTRAINT "weekly_log_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_enrollment_date" ON "attendance" USING btree ("enrollment_id","date");--> statement-breakpoint
CREATE INDEX "cohort_org" ON "cohort" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_cohort_user" ON "enrollment" USING btree ("cohort_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "progress_enrollment_item" ON "item_progress" USING btree ("enrollment_id","item_id");--> statement-breakpoint
CREATE INDEX "progress_enrollment" ON "item_progress" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "item_stage_key" ON "item" USING btree ("stage_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_user_org" ON "membership" USING btree ("user_id","org_id");--> statement-breakpoint
CREATE INDEX "membership_org_role" ON "membership" USING btree ("org_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "signoff_enrollment_stage" ON "stage_signoff" USING btree ("enrollment_id","stage_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stage_track_key" ON "stage" USING btree ("track_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_enrollment_week" ON "weekly_log" USING btree ("enrollment_id","week_start");