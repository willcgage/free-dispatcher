/**
 * Typed configuration loader (spec §11 / file manifest `lib/config.ts`).
 *
 * Reads env vars once with sane defaults. `SERVER_MODE` is set only on the
 * host machine; mobile clients omit it. Values here are read server-side.
 */

function bool(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

function int(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  /** True only on the event host machine (the server). */
  serverMode: bool(process.env.SERVER_MODE, false),

  /** Default HTTP port the Next.js server listens on. */
  port: int(process.env.PORT, 3000),

  /** Local PGlite data directory (embedded Postgres, fully offline). */
  dbDataDir: process.env.FD_DB_DIR ?? "./.data/freedispatcher",

  /** Optional WiThrottle monitor target (JMRI / DCC-EX). */
  withrottle: {
    host: process.env.NEXT_PUBLIC_WITHROTTLE_HOST ?? "",
    port: int(process.env.NEXT_PUBLIC_WITHROTTLE_PORT, 12090),
    enabled: bool(process.env.WITHROTTLE_ENABLED, false),
  },

  /** mDNS advertisement service type. */
  mdnsServiceType: "freedispatcher",

  /** Module Repository (modulerepo) integration — read-only per ADR-001. */
  moduleRepo: {
    // Supabase project URL for the Module Repository.
    url: process.env.MODULE_REPO_URL ?? "https://dpifxkipqfaxujidgjyg.supabase.co",
    // Public anon key — required as the `apikey` header on Supabase auth calls.
    // This is a client-side public key (exposed to browsers by design), so it
    // ships as the default for the production project, mirroring `url` above —
    // a packaged build has no .env, and without a default every admin login
    // fails with Supabase's "No API key found in request". Override via env
    // only when pointing at a local / staging instance.
    anonKey:
      process.env.MODULE_REPO_ANON_KEY ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaWZ4a2lwcWZheHVqaWRnanlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NzU2NjYsImV4cCI6MjA5NjM1MTY2Nn0.W91jEVB9GtIN3DViIgtW2ki2t1MyDGR18fIFG3UJ030",
  },
} as const;

export type AppConfig = typeof config;
