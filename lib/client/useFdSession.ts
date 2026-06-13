/**
 * useFdSession — live session state for client screens.
 *
 * Loads the full state from /api/session, then subscribes to /api/events (SSE)
 * and re-fetches state on any relevant event. Keeps a small live ops-log feed.
 * Returns a refresh() for imperative reloads after mutations.
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

/** Who is currently talking on voice, keyed by operatorId. */
export type TalkingMap = Record<string, { name: string; channel: string }>;

export interface UseFdSession {
  state: FullState | null;
  opsLog: OpsLogEntry[];
  connected: boolean;
  lastEvent: string | null;
  /** Operators currently transmitting on a voice channel (live, ephemeral). */
  talking: TalkingMap;
  refresh: () => Promise<void>;
}

export function useFdSession(): UseFdSession {
  const [state, setState] = useState<FullState | null>(null);
  const [opsLog, setOpsLog] = useState<OpsLogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [talking, setTalking] = useState<TalkingMap>({});
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

    const onEvent = (type: string) => () => {
      setLastEvent(type);
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
    ];
    const handlers = types.map((t) => {
      const h = onEvent(t);
      es.addEventListener(t, h as EventListener);
      return [t, h] as const;
    });

    // voice_talk is ephemeral presence — update the talking map, never refetch.
    const onTalk = (e: MessageEvent) => {
      setLastEvent("voice_talk");
      try {
        const d = JSON.parse(e.data) as {
          operatorId: string;
          name: string;
          channel: string;
          talking: boolean;
        };
        setTalking((prev) => {
          const next = { ...prev };
          if (d.talking) next[d.operatorId] = { name: d.name, channel: d.channel };
          else delete next[d.operatorId];
          return next;
        });
      } catch {
        /* ignore */
      }
    };
    es.addEventListener("voice_talk", onTalk as EventListener);

    return () => {
      for (const [t, h] of handlers)
        es.removeEventListener(t, h as EventListener);
      es.removeEventListener("voice_talk", onTalk as EventListener);
      es.close();
      esRef.current = null;
    };
  }, [refresh]);

  return { state, opsLog, connected, lastEvent, talking, refresh };
}
