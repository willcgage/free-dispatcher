ALTER TABLE "repo_modules" ADD COLUMN "schematics" jsonb;--> statement-breakpoint
-- Full re-sync so existing rows backfill their owner schematics (#122).
DELETE FROM "app_settings" WHERE "key" = 'module_repo_sync';