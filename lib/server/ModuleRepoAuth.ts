import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";
import { config } from "@/lib/config";

const AUTH_KEY = "module_repo_auth";
const EXPIRED_KEY = "module_repo_session_expired";

export class ReauthRequired extends Error {
  constructor() {
    super("Module Repository session expired — please sign in again");
    this.name = "ReauthRequired";
  }
}

// The anon key ships as a default (lib/config.ts), but a misconfigured env
// override could blank it. Guard before calling Supabase so we surface a clear,
// app-level message instead of leaking Supabase's raw "No API key found in
// request".
function assertConfigured(): void {
  if (!config.moduleRepo.anonKey) {
    throw new Error(
      "Module Repository is not configured (MODULE_REPO_ANON_KEY is empty).",
    );
  }
}

interface AuthRecord {
  email: string;
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO timestamp
}

async function readAuth(): Promise<AuthRecord | null> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, AUTH_KEY));
  return row ? (row.value as AuthRecord) : null;
}

async function writeAuth(record: AuthRecord): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: AUTH_KEY, value: record as unknown as object })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: record as unknown as object, updatedAt: new Date() },
    });
}

async function setSessionExpired(expired: boolean): Promise<void> {
  if (expired) {
    await db
      .insert(appSettings)
      .values({ key: EXPIRED_KEY, value: true as unknown as object })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: true as unknown as object, updatedAt: new Date() },
      });
  } else {
    await db.delete(appSettings).where(eq(appSettings.key, EXPIRED_KEY));
  }
}

export async function clearAuth(): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, AUTH_KEY));
}

// Supabase tokens expire after `expires_in` seconds; subtract 30s so we
// refresh before the window closes rather than on the exact boundary.
function expiresAt(expiresIn: number): string {
  return new Date(Date.now() + (expiresIn - 30) * 1000).toISOString();
}

export async function signIn(email: string, password: string): Promise<void> {
  assertConfigured();
  const res = await fetch(
    `${config.moduleRepo.url}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.moduleRepo.anonKey,
      },
      body: JSON.stringify({ email, password }),
    },
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(
      body.error_description ?? body.message ?? `Sign-in failed (${res.status})`,
    );
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
  };

  await writeAuth({
    email,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt(data.expires_in ?? 3600),
  });
  await setSessionExpired(false);
}

export async function signOut(): Promise<void> {
  await clearAuth();
  await setSessionExpired(false);
}

export async function getValidToken(): Promise<string> {
  const auth = await readAuth();
  if (!auth) throw new ReauthRequired();

  if (new Date(auth.expires_at) > new Date()) {
    return auth.access_token;
  }

  // Access token expired — try to refresh.
  assertConfigured();
  const res = await fetch(
    `${config.moduleRepo.url}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.moduleRepo.anonKey,
      },
      body: JSON.stringify({ refresh_token: auth.refresh_token }),
    },
  );

  if (!res.ok) {
    // Refresh token expired or revoked — force re-sign-in.
    await clearAuth();
    await setSessionExpired(true);
    throw new ReauthRequired();
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  await writeAuth({
    ...auth,
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? auth.refresh_token,
    expires_at: expiresAt(data.expires_in ?? 3600),
  });

  return data.access_token;
}

export async function getAuthStatus(): Promise<{
  authenticated: boolean;
  sessionExpired: boolean;
  email?: string;
  tokenExpiresAt?: string;
}> {
  const [authRow, expiredRow] = await Promise.all([
    db.select().from(appSettings).where(eq(appSettings.key, AUTH_KEY)),
    db.select().from(appSettings).where(eq(appSettings.key, EXPIRED_KEY)),
  ]);
  const auth = authRow[0] ? (authRow[0].value as AuthRecord) : null;
  const sessionExpired = expiredRow.length > 0;
  if (!auth) return { authenticated: false, sessionExpired };
  return { authenticated: true, sessionExpired: false, email: auth.email, tokenExpiresAt: auth.expires_at };
}
