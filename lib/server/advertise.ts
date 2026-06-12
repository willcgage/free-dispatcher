/**
 * Server network advertisement (spec §3.1, file manifest `lib/server/advertise.ts`).
 *
 *  - detects the host's LAN IP address
 *  - generates a QR code (data URL) encoding the server URL for phones to scan
 *  - advertises the server over mDNS as `_freedispatcher._tcp` so mobile
 *    clients can auto-discover it
 *
 * Uses `bonjour-service` (pure JS) rather than the native `mdns` package the
 * spec sketches, to avoid a native build step on the event laptop. mDNS may be
 * blocked on some mesh Wi-Fi (spec §12) — the QR code + manual URL entry are
 * the mandatory fallbacks.
 */
import { networkInterfaces } from "node:os";
import QRCode from "qrcode";
import { Bonjour, type Service } from "bonjour-service";
import { config } from "@/lib/config";

/** First non-internal IPv4 address, or 127.0.0.1 if none found. */
export function detectLanIp(): string {
  const ifaces = networkInterfaces();
  for (const addrs of Object.values(ifaces)) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address;
    }
  }
  return "127.0.0.1";
}

export function serverUrl(scheme: "http" | "https" = "http"): string {
  return `${scheme}://${detectLanIp()}:${config.port}`;
}

/** QR code as a PNG data URL encoding the server URL. */
export async function serverQrDataUrl(
  scheme: "http" | "https" = "http",
): Promise<string> {
  return QRCode.toDataURL(serverUrl(scheme), { width: 320, margin: 1 });
}

/** Snapshot of the info the Admin header needs (spec §3.1). */
export async function serverInfo(scheme: "http" | "https" = "http") {
  const ip = detectLanIp();
  return {
    ip,
    port: config.port,
    url: serverUrl(scheme),
    qrDataUrl: await serverQrDataUrl(scheme),
    serverMode: config.serverMode,
  };
}

// ---- mDNS advertisement (host only) --------------------------------------

const globalForAd = globalThis as unknown as {
  __fdBonjour?: Bonjour;
  __fdService?: Service;
};

/** Start advertising on mDNS. Idempotent; no-op if already advertising. */
export function startAdvertising(sessionName = "Free Dispatcher"): void {
  if (globalForAd.__fdService) return;
  const bonjour = globalForAd.__fdBonjour ?? new Bonjour();
  const service = bonjour.publish({
    name: "Free Dispatcher",
    type: config.mdnsServiceType, // -> _freedispatcher._tcp
    port: config.port,
    txt: { version: "2.0", layout: sessionName },
  });
  globalForAd.__fdBonjour = bonjour;
  globalForAd.__fdService = service;
}

export function stopAdvertising(): void {
  globalForAd.__fdService?.stop?.();
  globalForAd.__fdService = undefined;
  globalForAd.__fdBonjour?.destroy();
  globalForAd.__fdBonjour = undefined;
}
