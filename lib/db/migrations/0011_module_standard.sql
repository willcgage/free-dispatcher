ALTER TABLE "layouts" ADD COLUMN "standard" text DEFAULT 'freemon' NOT NULL;--> statement-breakpoint
ALTER TABLE "repo_modules" ADD COLUMN "standard" text;--> statement-breakpoint
-- Force the next Module Repository sync to be a full fetch so existing rows
-- backfill their new `standard` column (the incremental cursor is cleared).
DELETE FROM "app_settings" WHERE "key" = 'module_repo_sync';