ALTER TABLE "repo_modules" ADD COLUMN "owner" text;--> statement-breakpoint
-- Reset the sync cursor so the next catalog sync is a full backfill that
-- populates the new owner column (incremental sync would skip unchanged rows).
DELETE FROM "app_settings" WHERE "key" = 'module_repo_sync';