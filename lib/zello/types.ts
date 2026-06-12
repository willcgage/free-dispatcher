/**
 * Zello PTT types (spec §7.4). Role here is the operator role subset that maps
 * to a Zello channel set (admins ride along on OpsAll).
 */
export type Role = "dispatcher" | "engineer" | "yardmaster";

export interface ZelloConfig {
  /** wss endpoint; Zello consumer tier is wss://zello.io/ws */
  wsUrl: string;
  /** username used as the JWT subject and Zello logon */
  username: string;
  /** channel set available to this role */
  availableChannels: string[];
  /** default channel for this role */
  defaultChannel: string;
}

export interface ZelloContextValue {
  role: Role | null;
  activeChannel: string | null;
  availableChannels: string[];
  isConnected: boolean;
  isTx: boolean; // this device is transmitting
  rxSpeaker: string | null; // username currently speaking on channel
  configured: boolean; // token server + creds available
  error: string | null;
  setRole: (r: Role) => void;
  switchChannel: (ch: string) => void;
  startTx: () => void;
  stopTx: () => void;
}
