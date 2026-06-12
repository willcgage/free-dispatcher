/**
 * Voice channel model (free-Zello: channels are created by hand in the Zello
 * app; Free Dispatcher generates the names and the access map).
 *
 * Channels are defined per session by the Admin and stored in
 * app_settings.voiceChannels. Kinds drive which roles can access each channel
 * and which is the default on join.
 */
import type { OperatorRole } from "@/lib/db/schema";

export type ChannelKind = "opsall" | "district" | "yard" | "dispatch" | "tech";

export interface VoiceChannel {
  id: string;
  label: string; // human label, e.g. "Main Line North"
  kind: ChannelKind;
  zelloName: string; // exact Zello channel name to create, e.g. "FD-Main-Line-North"
}

/** Default channel set seeded for a new session (admin adds districts). */
export function defaultChannels(): VoiceChannel[] {
  const mk = (label: string, kind: ChannelKind, zelloName: string): VoiceChannel => ({
    id: cryptoId(),
    label,
    kind,
    zelloName,
  });
  return [
    mk("All Operators", "opsall", "FD-OpsAll"),
    mk("All Dispatchers", "dispatch", "FD-Dispatch"),
    mk("Yard", "yard", "FD-Yard"),
    mk("Technical Services", "tech", "FD-Tech"),
  ];
}

/** Generate a Zello channel name from a human label. */
export function slugifyChannel(label: string): string {
  const slug = label
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `FD-${slug}` : "FD-Channel";
}

const ROLE_ACCESS: Record<OperatorRole, ChannelKind[]> = {
  admin: ["opsall", "dispatch", "district", "yard", "tech"],
  dispatcher: ["opsall", "dispatch", "district", "tech"],
  engineer: ["opsall", "district", "tech"],
  yardmaster: ["opsall", "yard", "tech"],
};

/** Channels a role may use, in a stable display order. */
export function channelsForRole(
  channels: VoiceChannel[],
  role: OperatorRole,
): VoiceChannel[] {
  const allowed = new Set(ROLE_ACCESS[role]);
  const order: ChannelKind[] = ["dispatch", "yard", "district", "opsall", "tech"];
  return channels
    .filter((c) => allowed.has(c.kind))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

/** Default channel a role lands on. */
export function defaultChannelForRole(
  channels: VoiceChannel[],
  role: OperatorRole,
): string | null {
  const list = channelsForRole(channels, role);
  if (list.length === 0) return null;
  const prefer: Partial<Record<OperatorRole, ChannelKind>> = {
    dispatcher: "dispatch",
    yardmaster: "yard",
    engineer: "district",
  };
  const want = prefer[role];
  return (want && list.find((c) => c.kind === want)?.zelloName) ?? list[0].zelloName;
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `ch_${Math.random().toString(36).slice(2, 10)}`;
}
