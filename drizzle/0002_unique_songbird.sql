ALTER TABLE "track" ADD COLUMN "owner_org_id" text;--> statement-breakpoint
ALTER TABLE "track" ADD COLUMN "status" text DEFAULT 'PUBLISHED' NOT NULL;--> statement-breakpoint
ALTER TABLE "track" ADD COLUMN "draft" jsonb;--> statement-breakpoint
ALTER TABLE "track" ADD COLUMN "published_at" timestamp;--> statement-breakpoint
ALTER TABLE "track" ADD CONSTRAINT "track_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "track_owner" ON "track" USING btree ("owner_org_id");