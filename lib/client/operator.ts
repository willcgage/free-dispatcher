/**
 * Operator identity (mobile client). Stored in sessionStorage alongside the
 * session token so a refresh keeps the operator signed in for the session.
 */
"use client";

import type { OperatorRole } from "@/lib/db/schema";

const ROLE_KEY = "fd.role";
const NAME_KEY = "fd.name";
const DEVICE_KEY = "fd.deviceId";
const OPID_KEY = "fd.operatorId";

export interface Operator {
  role: OperatorRole;
  name: string;
  deviceId: string;
  operatorId: string;
}

export function getOperator(): Operator | null {
  if (typeof window === "undefined") return null;
  const role = window.sessionStorage.getItem(ROLE_KEY) as OperatorRole | null;
  const name = window.sessionStorage.getItem(NAME_KEY);
  const deviceId = window.sessionStorage.getItem(DEVICE_KEY);
  const operatorId = window.sessionStorage.getItem(OPID_KEY);
  if (!role || !name || !deviceId || !operatorId) return null;
  return { role, name, deviceId, operatorId };
}

export function setOperator(op: Operator): void {
  window.sessionStorage.setItem(ROLE_KEY, op.role);
  window.sessionStorage.setItem(NAME_KEY, op.name);
  window.sessionStorage.setItem(DEVICE_KEY, op.deviceId);
  window.sessionStorage.setItem(OPID_KEY, op.operatorId);
}

export function clearOperator(): void {
  for (const k of [ROLE_KEY, NAME_KEY, DEVICE_KEY, OPID_KEY, "fd.sessionToken"]) {
    window.sessionStorage.removeItem(k);
  }
}

/** Operator's default landing screen after join. */
export const HOME_BY_ROLE: Record<OperatorRole, string> = {
  admin: "/dispatch",
  dispatcher: "/dispatch",
  engineer: "/trains",
  yardmaster: "/modules",
};
