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
} as const;

export type AppConfig = typeof config;
