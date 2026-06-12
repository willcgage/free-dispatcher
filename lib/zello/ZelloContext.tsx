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
import { apiSend } from "@/lib/client/api";
import { getOperator, getZelloCreds, CHANNEL_DEFAULTS } from "@/lib/client/operator";
import type { Role, ZelloContextValue } from "./types";

const WS_URL = "wss://zello.io/ws";

export const ZelloContext = createContext<ZelloContextValue | null>(null);

/**
 * ZelloProvider (spec §7.3) — persists a Zello connection across operator
 * screen navigation. Degrades gracefully when the token server / credentials
 * are not configured (PTT shows "unavailable" rather than erroring).
 */
export function ZelloProvider({ children }: { children: React.ReactNode }) {
  const op = useMemo(() => getOperator(), []);
  const role = (op?.role === "admin" ? "dispatcher" : op?.role ?? null) as Role | null;
  const channelSet = op ? CHANNEL_DEFAULTS[op.role] : null;

  const [activeChannel, setActiveChannel] = useState<string | null>(
    channelSet?.default ?? null,
  );
  const [isConnected, setConnected] = useState(false);
  const [isTx, setTx] = useState(false);
  const [rxSpeaker, setRxSpeaker] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<ZelloService | null>(null);
  // Optional named Zello account (device-local) → enables in-app talk.
  const creds = useMemo(() => getZelloCreds(), []);
  const canTalk = Boolean(creds);

  // Establish the connection once we know the operator + default channel.
  useEffect(() => {
    if (!op || !channelSet) return;
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
          if (msg && /token server|unreachable|configured/i.test(msg)) {
            setConfigured(false);
          }
        },
      },
    });
    serviceRef.current = service;
    void service.connect(channelSet.default);
    return () => {
      service.disconnect();
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
    availableChannels: channelSet?.available ?? [],
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
