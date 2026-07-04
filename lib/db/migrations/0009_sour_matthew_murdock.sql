ALTER TABLE "repo_modules" ADD COLUMN "geometry_degrees" real;--> statement-breakpoint
ALTER TABLE "repo_modules" ADD COLUMN "geometry_offset_inches" real;--> statement-breakpoint
-- Reset the sync cursor so the next catalog sync backfills the new geometry
-- columns (incremental sync would skip unchanged rows).
DELETE FROM "app_settings" WHERE "key" = 'module_repo_sync';