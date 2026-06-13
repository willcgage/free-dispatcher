/**
 * Next.js instrumentation hook — runs once when the server process starts.
 * Brings the local DB schema up to date, then (on the host, SERVER_MODE=true)
 * begins mDNS advertisement so mobile clients can auto-discover it (spec §3.1).
 */
export async function register() {
  // Only the Node.js server runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Apply pending migrations on boot so a packaged host (#32) needs no CLI step.
  const { runMigrations } = await import("@/lib/db/runMigrations");
  await runMigrations();

  const { config } = await import("@/lib/config");
  if (!config.serverMode) return;

  const { startAdvertising, detectLanIp } = await import(
    "@/lib/server/advertise"
  );
  startAdvertising();
  console.log(
    `[freedispatcher] advertising on mDNS — http://${detectLanIp()}:${config.port}`,
  );
}
