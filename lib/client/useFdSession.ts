/**
 * useFdSession — live session state for client screens.
 *
 * Loads the full state from /api/session, then subscribes to /api/events (SSE)
 * and re-fetches state on any relevant event. Keeps a small live ops-log feed
 * and a "speaking" indicator for Zello tx events. Returns a refresh() for
 * imperative reloads after mutations.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "./api";
import type { FullState, OpsLogEntry } from "./types";

const REFETCH_EVENTS = new Set([
  "session_start",
  "train_status_changed",
  "operator_joined",
  "operator_left",
  "authority_granted",
  "authority_revoked",
  "emergency_stop",
]);

export interface UseFdSession {
  state: FullState | null;
  opsLog: OpsLogEntry[];
  connected: boolean;
  speaking: { operatorName: string; channel: string } | null;
  lastEvent: string | null;
  refresh: () => Promise<void>;
}

export function useFdSession(): UseFdSession {
  const [state, setState] = useState<FullState | null>(null);
  const [opsLog, setOpsLog] = useState<OpsLogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [speaking, setSpeaking] = useState<UseFdSession["speaking"]>(null);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    const [s, log] = await Promise.all([
      apiGet<FullState>("/api/session"),
      apiGet<{ entries: OpsLogEntry[] }>("/api/ops-log?limit=50"),
    ]);
    setState(s);
    setOpsLog(log.entries);
  }, []);

  useEffect(() => {
    // Initial load + subscribe to the SSE stream (external system). refresh()
    // is async: its setState calls run after an await, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();

    const es = new EventSource("/api/events");
    esRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const onEvent = (type: string) => (ev: MessageEvent) => {
      setLastEvent(type);
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(ev.data);
      } catch {
        /* ignore */
      }
      if (type === "zello_tx_start") {
        setSpeaking({
          operatorName: String(data.operatorName ?? ""),
          channel: String(data.channel ?? ""),
        });
      } else if (type === "zello_tx_stop") {
        setSpeaking(null);
      }
      if (REFETCH_EVENTS.has(type)) void refresh();
    };

    const types = [
      "session_start",
      "train_status_changed",
      "operator_joined",
      "operator_left",
      "authority_granted",
      "authority_revoked",
      "emergency_stop",
      "session_message",
      "zello_tx_start",
      "zello_tx_stop",
    ];
    const handlers = types.map((t) => {
      const h = onEvent(t);
      es.addEventListener(t, h as EventListener);
      return [t, h] as const;
    });

    return () => {
      for (const [t, h] of handlers)
        es.removeEventListener(t, h as EventListener);
      es.close();
      esRef.current = null;
    };
  }, [refresh]);

  return { state, opsLog, connected, speaking, lastEvent, refresh };
}
