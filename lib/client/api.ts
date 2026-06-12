/**
 * Client-side fetch helpers. Carries the session token (stored in
 * sessionStorage) as a bearer header on writes.
 */
"use client";

const TOKEN_KEY = "fd.sessionToken";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiSend<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `${method} ${path} → ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) detail = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

/** Ensure we hold an admin token (host UI). Idempotent. */
export async function ensureAdminToken(): Promise<void> {
  if (getToken()) return;
  const { sessionToken } = await apiGet<{ sessionToken: string }>(
    "/api/admin/token",
  );
  setToken(sessionToken);
}
