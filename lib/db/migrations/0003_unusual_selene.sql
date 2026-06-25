CREATE TABLE "repo_modules" (
	"record_number" text PRIMARY KEY NOT NULL,
	"module_name" text NOT NULL,
	"description" text,
	"category" text,
	"geometry_type" text,
	"length_feet" integer,
	"length_inches" integer,
	"endplate_count" integer,
	"has_mss" boolean,
	"mss_type" text,
	"status" text,
	"endplates" jsonb,
	"tracks" jsonb,
	"industries" jsonb,
	"upstream_updated_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
