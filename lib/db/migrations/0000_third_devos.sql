CREATE TABLE "authority_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"train_id" uuid,
	"segment" text,
	"action" text NOT NULL,
	"by_operator" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_layouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"module_id" text NOT NULL,
	"position_index" integer DEFAULT 0 NOT NULL,
	"staging_end" text
);
--> statement-breakpoint
CREATE TABLE "operators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"device_id" text,
	"zello_channel" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ops_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"date" text,
	"venue" text,
	"layout_config_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staging_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"layout_id" uuid NOT NULL,
	"end" text NOT NULL,
	"track_name" text NOT NULL,
	"assigned_train_id" uuid
);
--> statement-breakpoint
CREATE TABLE "train_statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"train_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"status" text DEFAULT 'yard' NOT NULL,
	"location_name" text,
	"has_authority" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"number" text NOT NULL,
	"name" text,
	"dcc_address" integer,
	"dcc_type" text,
	"owner" text,
	"consist_id" text,
	"equipment_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "authority_log" ADD CONSTRAINT "authority_log_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authority_log" ADD CONSTRAINT "authority_log_train_id_trains_id_fk" FOREIGN KEY ("train_id") REFERENCES "public"."trains"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_layouts" ADD CONSTRAINT "module_layouts_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operators" ADD CONSTRAINT "operators_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops_log" ADD CONSTRAINT "ops_log_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staging_tracks" ADD CONSTRAINT "staging_tracks_layout_id_module_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."module_layouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staging_tracks" ADD CONSTRAINT "staging_tracks_assigned_train_id_trains_id_fk" FOREIGN KEY ("assigned_train_id") REFERENCES "public"."trains"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "train_statuses" ADD CONSTRAINT "train_statuses_train_id_trains_id_fk" FOREIGN KEY ("train_id") REFERENCES "public"."trains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "train_statuses" ADD CONSTRAINT "train_statuses_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trains" ADD CONSTRAINT "trains_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "authority_log_session_idx" ON "authority_log" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "module_layouts_session_idx" ON "module_layouts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "operators_session_idx" ON "operators" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "operators_device_idx" ON "operators" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "ops_log_session_idx" ON "ops_log" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_one_active" ON "sessions" USING btree ("status") WHERE "sessions"."status" = 'active';--> statement-breakpoint
CREATE INDEX "staging_tracks_layout_idx" ON "staging_tracks" USING btree ("layout_id");--> statement-breakpoint
CREATE INDEX "train_statuses_train_idx" ON "train_statuses" USING btree ("train_id");--> statement-breakpoint
CREATE INDEX "train_statuses_session_idx" ON "train_statuses" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "trains_session_idx" ON "trains" USING btree ("session_id");