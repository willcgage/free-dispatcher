ALTER TABLE "layouts" ADD COLUMN "branches" jsonb;
--> statement-breakpoint
ALTER TABLE "module_layouts" ADD COLUMN "branch_id" text;
