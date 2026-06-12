/**
 * Next.js instrumentation hook — runs once when the server process starts.
 * On the host (SERVER_MODE=true) we begin mDNS advertisement so mobile
 * clients can auto-discover this server (spec §3.1).
 */
export async function register() {
  // Only the Node.js server runtime, and only on the host machine.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

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
