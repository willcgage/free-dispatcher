/**
 * Route RBAC helpers (spec §2 roles, §5.2 "enforced server-side").
 * Decode the session token and assert the caller's role.
 */
import { NextResponse } from "next/server";
import { tokenFromRequest, type SessionClaims } from "./sessionToken";
import type { OperatorRole } from "@/lib/db/schema";

export type GuardResult =
  | { ok: true; claims: SessionClaims }
  | { ok: false; response: NextResponse };

/** Require a valid token whose role is in `allowed`. */
export function requireRole(
  req: Request,
  allowed: OperatorRole[],
): GuardResult {
  const claims = tokenFromRequest(req);
  if (!claims) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "missing or invalid session token" },
        { status: 401 },
      ),
    };
  }
  if (!allowed.includes(claims.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `role ${claims.role} not permitted` },
        { status: 403 },
      ),
    };
  }
  return { ok: true, claims };
}
