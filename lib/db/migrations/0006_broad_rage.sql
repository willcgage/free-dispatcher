CREATE TABLE "turnout_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"turnout_id" uuid NOT NULL,
	"position" text DEFAULT 'normal' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turnouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "turnout_positions" ADD CONSTRAINT "turnout_positions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnout_positions" ADD CONSTRAINT "turnout_positions_turnout_id_turnouts_id_fk" FOREIGN KEY ("turnout_id") REFERENCES "public"."turnouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turnouts" ADD CONSTRAINT "turnouts_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "turnout_positions_session_turnout" ON "turnout_positions" USING btree ("session_id","turnout_id");--> statement-breakpoint
CREATE INDEX "turnout_positions_session_idx" ON "turnout_positions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "turnouts_district_idx" ON "turnouts" USING btree ("district_id");