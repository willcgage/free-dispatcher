ALTER TABLE "layouts" ADD COLUMN "joins" jsonb;
--> statement-breakpoint
ALTER TABLE "module_layouts" ADD COLUMN "mirrored" boolean DEFAULT false NOT NULL;
