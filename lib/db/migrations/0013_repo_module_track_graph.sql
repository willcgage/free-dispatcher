ALTER TABLE "repo_modules" ADD COLUMN "schematic" jsonb;--> statement-breakpoint
-- Full re-sync so existing rows backfill their authored track-graph (#122).
DELETE FROM "app_settings" WHERE "key" = 'module_repo_sync';