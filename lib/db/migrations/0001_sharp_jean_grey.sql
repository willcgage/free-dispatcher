CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trains" ADD COLUMN "assigned_operator_id" uuid;--> statement-breakpoint
CREATE INDEX "trains_assigned_idx" ON "trains" USING btree ("assigned_operator_id");