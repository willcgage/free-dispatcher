/**
 * GET /api/modules/schematic-url?path=<storage_path> — resolve a short-lived
 * signed URL for an owner-uploaded module schematic (#122). Proxies the Module
 * Repository `module-schematic-url` function (the schematics bucket is private),
 * so the client never sees the anon key or deals with CORS. Any authenticated
 * Free Dispatcher role may view schematics.
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { requireRole } from "@/lib/server/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const guard = requireRole(req, ["admin", "dispatcher", "engineer", "yardmaster"]);
  if (!guard.ok) return guard.response;

  const path = new URL(req.url).searchParams.get("path")?.trim();
  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const upstream = new URL(
    `${config.moduleRepo.url}/functions/v1/module-schematic-url`,
  );
  upstream.searchParams.set("path", path);

  let res: Response;
  try {
    res = await fetch(upstream.toString(), {
      headers: {
        apikey: config.moduleRepo.anonKey,
        Authorization: `Bearer ${config.moduleRepo.anonKey}`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the Module Repository." },
      { status: 502 },
    );
  }

  const body = (await res.json().catch(() => null)) as
    | { url?: string; file_name?: string; file_format?: string; message?: string }
    | null;

  if (!res.ok || !body?.url) {
    return NextResponse.json(
      { error: body?.message ?? `Module Repository returned ${res.status}.` },
      { status: res.status === 404 ? 404 : 502 },
    );
  }

  return NextResponse.json({
    url: body.url,
    fileName: body.file_name ?? null,
    fileFormat: body.file_format ?? null,
  });
}
