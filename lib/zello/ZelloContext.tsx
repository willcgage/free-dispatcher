"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ZelloService } from "./ZelloService";
import { apiGet, apiSend } from "@/lib/client/api";
import { getOperator, getZelloCreds } from "@/lib/client/operator";
import {
  channelsForRole,
  defaultChannelForRole,
  defaultChannels,
  type VoiceChannel,
} from "./channels";
import type { Role, ZelloContextValue } from "./types";

const WS_URL = "wss://zello.io/ws";

export const ZelloContext = createContext<ZelloContextValue | null>(null);

/**
 * ZelloProvider (spec §7.3) — persists a Zello connection across operator
 * screen navigation. Channels come from the session's voice-channel config
 * (Admin → Voice channels), filtered by role. Degrades gracefully when no
 * Zello token is configured (PTT shows "unavailable" rather than erroring).
 */
export function ZelloProvider({ children }: { children: React.ReactNode }) {
  const op = useMemo(() => getOperator(), []);
  const role = (op?.role === "admin" ? "dispatcher" : op?.role ?? null) as Role | null;

  const [availableChannels, setAvailableChannels] = useState<string[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [isConnected, setConnected] = useState(false);
  const [isTx, setTx] = useState(false);
  const [rxSpeaker, setRxSpeaker] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<ZelloService | null>(null);
  // Optional named Zello account (device-local) → enables in-app talk.
  const creds = useMemo(() => getZelloCreds(), []);
  const canTalk = Boolean(creds);

  // Load the session's channels, then connect to the role's default channel.
  useEffect(() => {
    if (!op) return;
    let cancelled = false;

    (async () => {
      let all: VoiceChannel[] = defaultChannels();
      try {
        const r = await apiGet<{ settings: { voiceChannels?: VoiceChannel[] } }>(
          "/api/settings",
        );
        if (r.settings?.voiceChannels?.length) all = r.settings.voiceChannels;
      } catch {
        /* use defaults */
      }
      if (cancelled) return;

      const mine = channelsForRole(all, op.role);
      const names = mine.map((c) => c.zelloName);
      const def = defaultChannelForRole(all, op.role);
      setAvailableChannels(names);
      setActiveChannel(def);

      const service = new ZelloService({
        wsUrl: WS_URL,
        tokenUrl: "/api/zello/token",
        zelloUsername: creds?.username,
        zelloPassword: creds?.password,
        callbacks: {
          onState: setConnected,
          onRxSpeaker: setRxSpeaker,
          onTx: setTx,
          onError: (msg) => {
            setError(msg);
            if (msg && /token|unreachable|configured/i.test(msg)) {
              setConfigured(false);
            }
          },
        },
      });
      serviceRef.current = service;
      if (def) void service.connect(def);
    })();

    return () => {
      cancelled = true;
      serviceRef.current?.disconnect();
      serviceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchChannel = useCallback((ch: string) => {
    setActiveChannel(ch);
    void serviceRef.current?.switchChannel(ch);
  }, []);

  const startTx = useCallback(() => {
    void serviceRef.current?.startTx();
    if (activeChannel) {
      void apiSend("POST", "/api/zello/tx", { action: "start", channel: activeChannel }).catch(
        () => {},
      );
    }
  }, [activeChannel]);

  const stopTx = useCallback(() => {
    serviceRef.current?.stopTx();
    if (activeChannel) {
      void apiSend("POST", "/api/zello/tx", { action: "stop", channel: activeChannel }).catch(
        () => {},
      );
    }
  }, [activeChannel]);

  const value: ZelloContextValue = {
    role,
    activeChannel,
    availableChannels,
    isConnected,
    isTx,
    rxSpeaker,
    configured,
    canTalk,
    error,
    setRole: () => {},
    switchChannel,
    startTx,
    stopTx,
  };

  return <ZelloContext.Provider value={value}>{children}</ZelloContext.Provider>;
}
