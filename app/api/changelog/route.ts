/**
 * GET /api/changelog — parsed release notes for the in-app Release Notes page.
 *
 * Reads the bundled CHANGELOG.md from the server's working directory (the repo
 * root in dev; the standalone dir in a packaged build, where prepare-standalone
 * copies it). Fully offline — no network. Returns the current app version too
 * so the UI can highlight "what you're running".
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { parseChangelog, isReleased } from "@/lib/changelog/parse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VERSION =
  process.env.FD_APP_VERSION ?? process.env.npm_package_version ?? "dev";

export async function GET() {
  try {
    const md = await readFile(join(process.cwd(), "CHANGELOG.md"), "utf8");
    // Released versions only — the in-progress "Unreleased" section is internal.
    const entries = parseChangelog(md).filter((e) => isReleased(e.version));
    return NextResponse.json({ version: VERSION, entries });
  } catch {
    return NextResponse.json({ version: VERSION, entries: [] });
  }
}
