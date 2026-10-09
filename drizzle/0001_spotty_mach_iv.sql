CREATE TABLE "cohort_coverage" (
	"id" text PRIMARY KEY NOT NULL,
	"cohort_id" text NOT NULL,
	"item_id" text NOT NULL,
	"taught_on" date NOT NULL,
	"taught_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_progress" ADD COLUMN "marked_by_id" text;--> statement-breakpoint
ALTER TABLE "cohort_coverage" ADD CONSTRAINT "cohort_coverage_cohort_id_cohort_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohort"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_coverage" ADD CONSTRAINT "cohort_coverage_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_coverage" ADD CONSTRAINT "cohort_coverage_taught_by_id_user_id_fk" FOREIGN KEY ("taught_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coverage_cohort_item" ON "cohort_coverage" USING btree ("cohort_id","item_id");--> statement-breakpoint
ALTER TABLE "item_progress" ADD CONSTRAINT "item_progress_marked_by_id_user_id_fk" FOREIGN KEY ("marked_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;