/**
 * Zello credential store (server-only). Persists the issuer + private key the
 * Admin pastes into a local JSON file (gitignored, host-only) so the server
 * reads them back on every start to self-sign Channel API tokens.
 *
 * The file is written with 0600 perms. The private key is never returned to
 * clients — only `configured` + the (non-secret) issuer are surfaced.
 */
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "@/lib/config";

export interface ZelloCredentials {
  issuer: string;
  privateKey: string;
}

export function readZelloCredentials(): ZelloCredentials | null {
  try {
    const raw = readFileSync(config.zelloCredsFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<ZelloCredentials>;
    if (parsed.issuer && parsed.privateKey) {
      return { issuer: parsed.issuer, privateKey: parsed.privateKey };
    }
  } catch {
    /* missing or unreadable — treat as not configured */
  }
  return null;
}

export function writeZelloCredentials(creds: ZelloCredentials): void {
  mkdirSync(dirname(config.zelloCredsFile), { recursive: true });
  writeFileSync(config.zelloCredsFile, JSON.stringify(creds, null, 2), {
    mode: 0o600,
  });
}

export function clearZelloCredentials(): void {
  if (existsSync(config.zelloCredsFile)) {
    rmSync(config.zelloCredsFile, { force: true });
  }
}

/**
 * Effective credentials: the saved file takes precedence, then env vars
 * (ZELLO_ISSUER / ZELLO_PRIVATE_KEY, useful for headless deploys).
 */
export function effectiveZelloCredentials(): ZelloCredentials | null {
  const file = readZelloCredentials();
  if (file) return file;
  const issuer = process.env.ZELLO_ISSUER;
  const privateKey = process.env.ZELLO_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (issuer && privateKey) return { issuer, privateKey };
  return null;
}
