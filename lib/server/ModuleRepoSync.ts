import { and, eq, isNull, notInArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { appSettings, repoModules } from "@/lib/db/schema";
import { config } from "@/lib/config";
import { getValidToken, clearAuth, ReauthRequired } from "./ModuleRepoAuth";

const SYNC_KEY = "module_repo_sync";

interface SyncMeta {
  last_synced_at: string;
  module_count: number;
}

async function readSyncMeta(): Promise<SyncMeta | null> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, SYNC_KEY));
  return row ? (row.value as SyncMeta) : null;
}

async function writeSyncMeta(meta: SyncMeta): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: SYNC_KEY, value: meta as unknown as object })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: meta as unknown as object, updatedAt: new Date() },
    });
}

export interface SyncResult {
  synced: number;
  /** Modules newly tombstoned this sync — gone from the repo (#155). */
  removed: number;
  lastSyncedAt: string;
}

export interface SyncError {
  error: "session_expired" | "no_access" | "network_error" | "api_error";
  message: string;
}

// Shape returned by GET /api/v1/modules/full (subset we store).
interface ModuleFull {
  record_number: string;
  module_name: string;
  standard?: string | null;
  owner?: string | null;
  description?: string | null;
  category?: string | null;
  geometry_type?: string | null;
  geometry_degrees?: number | null;
  geometry_offset_inches?: number | null;
  length_total_inches?: number | null;
  mainline_length_inches?: number | null;
  endplate_count?: number | null;
  has_mss?: boolean | null;
  mss_type?: string | null;
  status?: string | null;
  updated_at?: string | null;
  endplates?: unknown;
  tracks?: unknown;
  industries?: unknown;
  schematics?: unknown;
  schematic?: unknown;
}

export async function syncModules(): Promise<SyncResult | SyncError> {
  let token: string;
  try {
    token = await getValidToken();
  } catch (err) {
    if (err instanceof ReauthRequired) {
      return { error: "session_expired", message: (err as Error).message };
    }
    return { error: "network_error", message: String(err) };
  }

  const meta = await readSyncMeta();
  // Supabase routes /functions/v1/<slug> by the first path segment, so the
  // endpoint is the function's own slug. (The earlier `/api/v1/modules/full`
  // path resolved to a non-existent `api` function and 404'd — issue #70.)
  const url = new URL(`${config.moduleRepo.url}/functions/v1/modules-full`);
  if (meta?.last_synced_at) {
    url.searchParams.set("updated_since", meta.last_synced_at);
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: config.moduleRepo.anonKey,
      },
    });
  } catch {
    return {
      error: "network_error",
      message: "Could not reach the Module Repository. Check your internet connection.",
    };
  }

  if (res.status === 401) {
    await clearAuth();
    return { error: "session_expired", message: "Session expired — please sign in again." };
  }

  if (res.status === 403) {
    return {
      error: "no_access",
      message: "Your Module Repository account does not have show_master access.",
    };
  }

  if (!res.ok) {
    // Surface the real status + any upstream message, so the next endpoint
    // problem is self-diagnosing instead of a bare "api_error" (#70).
    const body = (await res.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    const base =
      res.status === 404
        ? "Module Repository sync endpoint not found (404) — check the function path/config."
        : `Module Repository returned ${res.status}.`;
    const detail = body?.message ?? body?.error;
    return { error: "api_error", message: detail ? `${base} ${detail}` : base };
  }

  const modules = (await res.json()) as ModuleFull[];

  for (const m of modules) {
    const values = {
      moduleName: m.module_name,
      standard: m.standard ?? null,
      owner: m.owner ?? null,
      description: m.description ?? null,
      category: m.category ?? null,
      geometryType: m.geometry_type ?? null,
      geometryDegrees: m.geometry_degrees ?? null,
      geometryOffsetInches: m.geometry_offset_inches ?? null,
      lengthTotalInches: m.length_total_inches ?? null,
      mainlineLengthInches: m.mainline_length_inches ?? null,
      endplateCount: m.endplate_count ?? null,
      hasMss: m.has_mss ?? null,
      mssType: m.mss_type ?? null,
      status: m.status ?? null,
      endplates: (m.endplates ?? null) as object | null,
      tracks: (m.tracks ?? null) as object | null,
      industries: (m.industries ?? null) as object | null,
      schematics: (m.schematics ?? null) as object | null,
      schematic: (m.schematic ?? null) as object | null,
      upstreamUpdatedAt: m.updated_at ? new Date(m.updated_at) : null,
      syncedAt: new Date(),
      // A record the repo returns is present — clear any tombstone (#155).
      removedFromRepoAt: null,
    };

    await db
      .insert(repoModules)
      .values({ recordNumber: m.record_number, ...values })
      .onConflictDoUpdate({ target: repoModules.recordNumber, set: values });
  }

  // Tombstone local records the repo no longer returns (#155). Guarded: an
  // empty catalog is treated as an upstream problem, not a mass removal.
  let removed = 0;
  if (modules.length > 0) {
    const fetched = modules.map((m) => m.record_number);
    const retired = await db
      .update(repoModules)
      .set({ removedFromRepoAt: new Date() })
      .where(
        and(
          isNull(repoModules.removedFromRepoAt),
          notInArray(repoModules.recordNumber, fetched),
        ),
      )
      .returning({ recordNumber: repoModules.recordNumber });
    removed = retired.length;
  }

  const [{ count }] = await db
    .select({ count: db.$count(repoModules) })
    .from(repoModules);

  const now = new Date().toISOString();
  await writeSyncMeta({ last_synced_at: now, module_count: Number(count) });

  return { synced: modules.length, removed, lastSyncedAt: now };
}

export async function getSyncMeta(): Promise<SyncMeta | null> {
  return readSyncMeta();
}
