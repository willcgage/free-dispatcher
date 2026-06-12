/**
 * Session tokens (spec §5.2). Issued on join, verified by protected routes.
 *
 * No passwords (per spec, sessions favour simplicity): a token is a signed
 * claim of { operatorId, sessionId, role, deviceId }. Signed with an HMAC
 * secret so clients cannot forge or escalate roles. RBAC is then enforced
 * server-side per route using the decoded role.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { OperatorRole } from "@/lib/db/schema";

export interface SessionClaims {
  operatorId: string;
  sessionId: string;
  role: OperatorRole;
  deviceId: string;
}

// Dev default; override with FD_TOKEN_SECRET on the host for real sessions.
const SECRET = process.env.FD_TOKEN_SECRET ?? "fd-dev-insecure-secret";

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", SECRET).update(payload).digest());
}

export function issueToken(claims: SessionClaims): string {
  const payload = b64url(JSON.stringify(claims));
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | null | undefined): SessionClaims | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
    ) as SessionClaims;
  } catch {
    return null;
  }
}

/** Extract a bearer token from a request's Authorization header. */
export function tokenFromRequest(req: Request): SessionClaims | null {
  const auth = req.headers.get("authorization");
  const token = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : null;
  return verifyToken(token);
}
