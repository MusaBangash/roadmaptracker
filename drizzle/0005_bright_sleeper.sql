CREATE TYPE "public"."comment_kind" AS ENUM('COMMENT', 'VERIFIED', 'NEEDS_WORK', 'RESUBMIT');--> statement-breakpoint
CREATE TYPE "public"."comment_role" AS ENUM('STUDENT', 'TEACHER');--> statement-breakpoint
CREATE TABLE "comment" (
	"id" text PRIMARY KEY NOT NULL,
	"enrollment_id" text NOT NULL,
	"item_id" text NOT NULL,
	"author_id" text,
	"author_role" "comment_role" NOT NULL,
	"kind" "comment_kind" DEFAULT 'COMMENT' NOT NULL,
	"body" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp,
	"hidden_at" timestamp,
	"hidden_by_id" text
);
--> statement-breakpoint
ALTER TABLE "item_progress" ADD COLUMN "student_seen_at" timestamp;--> statement-breakpoint
ALTER TABLE "item_progress" ADD COLUMN "staff_seen_at" timestamp;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_hidden_by_id_user_id_fk" FOREIGN KEY ("hidden_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_thread" ON "comment" USING btree ("enrollment_id","item_id","created_at");--> statement-breakpoint
CREATE INDEX "comment_author_time" ON "comment" USING btree ("author_id","created_at");--> statement-breakpoint
-- Comments, Story 2: earlier review decisions become the first entries of each thread, so no note is lost.
INSERT INTO "comment" ("id", "enrollment_id", "item_id", "author_id", "author_role", "kind", "body", "created_at")
SELECT gen_random_uuid()::text, "enrollment_id", "item_id", "reviewed_by_id", 'TEACHER',
       CASE WHEN "status" = 'VERIFIED' THEN 'VERIFIED'::"comment_kind" ELSE 'NEEDS_WORK'::"comment_kind" END,
       "review_note", "reviewed_at"
FROM "item_progress" WHERE "reviewed_at" IS NOT NULL;--> statement-breakpoint
-- Nothing that existed before comments counts as "new".
UPDATE "item_progress" SET "student_seen_at" = now(), "staff_seen_at" = now();
