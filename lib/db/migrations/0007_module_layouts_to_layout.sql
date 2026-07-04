DELETE FROM "module_layouts";--> statement-breakpoint
ALTER TABLE "module_layouts" DROP CONSTRAINT "module_layouts_session_id_sessions_id_fk";--> statement-breakpoint
DROP INDEX "module_layouts_session_idx";--> statement-breakpoint
ALTER TABLE "module_layouts" ADD COLUMN "layout_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "module_layouts" DROP COLUMN "session_id";--> statement-breakpoint
ALTER TABLE "module_layouts" ADD CONSTRAINT "module_layouts_layout_id_layouts_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."layouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "module_layouts_layout_idx" ON "module_layouts" USING btree ("layout_id");