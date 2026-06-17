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

export interface LanInterface {
  name: string;
  address: string;
}

/**
 * Preference rank for the default address (lower = better). Real LAN ranges
 * win; VPN/CGNAT (100.64/10, e.g. Tailscale) and link-local lose — they can
 * auto-detect first on some machines but aren't reachable by LAN phones.
 */
function addressRank(ip: string): number {
  if (ip.startsWith("192.168.")) return 0;
  if (ip.startsWith("10.")) return 1;
  const m = ip.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return 2;
  if (ip.startsWith("169.254.")) return 8; // link-local
  if (ip.startsWith("100.")) return 9; // CGNAT / Tailscale — last resort
  return 5; // other / public / unknown VPN
}

/** All non-internal IPv4 interfaces, best LAN candidate first. */
export function listLanIps(): LanInterface[] {
  const out: LanInterface[] = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        out.push({ name, address: addr.address });
      }
    }
  }
  return out.sort((a, b) => addressRank(a.address) - addressRank(b.address));
}

/** Best-guess LAN IP (preferred private range), or 127.0.0.1 if none. */
export function detectLanIp(): string {
  return listLanIps()[0]?.address ?? "127.0.0.1";
}

/** URL for a specific host, or the auto-detected default. */
export function serverUrl(scheme: "http" | "https" = "http", host?: string): string {
  return `${scheme}://${host || detectLanIp()}:${config.port}`;
}

/** QR code as a PNG data URL encoding the server URL. */
export async function serverQrDataUrl(
  scheme: "http" | "https" = "http",
  host?: string,
): Promise<string> {
  return QRCode.toDataURL(serverUrl(scheme, host), { width: 320, margin: 1 });
}

/**
 * Snapshot of the info the host console needs (spec §3.1). The server listens
 * on all interfaces; `interfaces` lists the candidate addresses, and `host`
 * (if a valid interface IP) selects which one `url`/`qrDataUrl` point at.
 */
export async function serverInfo(scheme: "http" | "https" = "http", host?: string) {
  const interfaces = listLanIps();
  const ip = host && interfaces.some((i) => i.address === host) ? host : detectLanIp();
  return {
    ip,
    port: config.port,
    url: serverUrl(scheme, ip),
    qrDataUrl: await serverQrDataUrl(scheme, ip),
    serverMode: config.serverMode,
    interfaces,
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
