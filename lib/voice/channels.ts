/**
 * Voice channel model (WebRTC in-app PTT, Option A — see V2_BUILD_PLAN §5).
 *
 * Channels are **session-local**: there is no external account or global
 * namespace (the whole reason Zello was dropped). The set is deterministic and
 * derived from the operator's role, so both the client and the signaling
 * endpoint can resolve it without a DB round-trip — the client renders the
 * picker, the server uses the same map to authorize a peer onto a channel.
 *
 * Each channel maps to one WebRTC mesh "room", keyed per session+channel
 * (`roomId`) so concurrent sessions can never collide.
 */
import type { OperatorRole } from "@/lib/db/schema";

export type ChannelKind = "opsall" | "dispatch" | "yard" | "tech";

export interface VoiceChannel {
  id: ChannelKind;
  label: string;
}

/** The fixed channel set for a session, in a stable display order. */
export const CHANNELS: VoiceChannel[] = [
  { id: "dispatch", label: "Dispatch" },
  { id: "yard", label: "Yard" },
  { id: "opsall", label: "All Operators" },
  { id: "tech", label: "Tech Services" },
];

/** Which channels each role may join (server-enforced; spec §4 RBAC). */
const ROLE_ACCESS: Record<OperatorRole, ChannelKind[]> = {
  admin: ["dispatch", "yard", "opsall", "tech"],
  dispatcher: ["dispatch", "yard", "opsall", "tech"],
  engineer: ["dispatch", "opsall", "tech"],
  yardmaster: ["yard", "opsall", "tech"],
};

/** Channel a role lands on by default after enabling voice. */
const DEFAULT_BY_ROLE: Record<OperatorRole, ChannelKind> = {
  admin: "dispatch",
  dispatcher: "dispatch",
  engineer: "opsall",
  yardmaster: "yard",
};

/** Channels a role may use, in display order. */
export function channelsForRole(role: OperatorRole): VoiceChannel[] {
  const allowed = new Set(ROLE_ACCESS[role]);
  return CHANNELS.filter((c) => allowed.has(c.id));
}

/** True if a role is permitted on a channel (server-side authorization). */
export function roleCanAccess(role: OperatorRole, channel: string): boolean {
  return (ROLE_ACCESS[role] as string[]).includes(channel);
}

/** The default channel id a role joins first. */
export function defaultChannelForRole(role: OperatorRole): ChannelKind {
  return DEFAULT_BY_ROLE[role];
}

/** Mesh room id for a session+channel — namespaces signaling per session. */
export function roomId(sessionId: string, channel: string): string {
  return `${sessionId}:${channel}`;
}
