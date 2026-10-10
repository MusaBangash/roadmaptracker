CREATE TYPE "public"."fault_status" AS ENUM('MISSING', 'NOT_WORKING', 'DAMAGED');--> statement-breakpoint
CREATE TABLE "lab_fault" (
	"id" text PRIMARY KEY NOT NULL,
	"lab_id" text NOT NULL,
	"org_id" text NOT NULL,
	"station" text NOT NULL,
	"item" text NOT NULL,
	"status" "fault_status" NOT NULL,
	"note" text,
	"inspection_id" text,
	"reported_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"fixed_at" timestamp,
	"fixed_by_id" text,
	"fix_note" text
);
--> statement-breakpoint
CREATE TABLE "lab_inspection" (
	"id" text PRIMARY KEY NOT NULL,
	"lab_id" text NOT NULL,
	"org_id" text NOT NULL,
	"inspected_on" date NOT NULL,
	"by_id" text,
	"lab_name" text NOT NULL,
	"pc_count" integer NOT NULL,
	"pc_items" jsonb NOT NULL,
	"room_items" jsonb NOT NULL,
	"findings" jsonb NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_teacher" (
	"lab_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "lab_teacher_lab_id_user_id_pk" PRIMARY KEY("lab_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "lab" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"pc_count" integer NOT NULL,
	"pc_items" jsonb NOT NULL,
	"room_items" jsonb NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lab_fault" ADD CONSTRAINT "lab_fault_lab_id_lab_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."lab"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_fault" ADD CONSTRAINT "lab_fault_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_fault" ADD CONSTRAINT "lab_fault_inspection_id_lab_inspection_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."lab_inspection"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_fault" ADD CONSTRAINT "lab_fault_reported_by_id_user_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_fault" ADD CONSTRAINT "lab_fault_fixed_by_id_user_id_fk" FOREIGN KEY ("fixed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_inspection" ADD CONSTRAINT "lab_inspection_lab_id_lab_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."lab"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_inspection" ADD CONSTRAINT "lab_inspection_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_inspection" ADD CONSTRAINT "lab_inspection_by_id_user_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_teacher" ADD CONSTRAINT "lab_teacher_lab_id_lab_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."lab"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_teacher" ADD CONSTRAINT "lab_teacher_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab" ADD CONSTRAINT "lab_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lab_fault_lab" ON "lab_fault" USING btree ("lab_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lab_fault_one_open" ON "lab_fault" USING btree ("lab_id","station","item") WHERE "fixed_at" is null;--> statement-breakpoint
CREATE INDEX "lab_inspection_lab" ON "lab_inspection" USING btree ("lab_id","inspected_on");--> statement-breakpoint
CREATE INDEX "lab_org" ON "lab" USING btree ("org_id");