"use client";

/**
 * useVoiceChannel — production WebRTC PTT for one voice channel.
 *
 * Graduated from the `/spike/ptt` proof. Manages: mic acquisition (PTT-gated,
 * muted until held), an EventSource to `/api/voice/signal` for negotiation, a
 * full mesh of RTCPeerConnections (one per other operator on the channel), and
 * per-peer audio playback. Peer ids are operator ids, so talk indicators
 * (delivered out-of-band via the `voice_talk` FdEvent) map straight to peers.
 *
 * Mic permission is acquired once when voice is enabled and kept across channel
 * switches; only the signaling + peer mesh tear down and rebuild on a switch.
 * A screen Wake Lock is held while enabled so the operator's device doesn't
 * sleep mid-session (the spec's "keep audio alive on mobile" ask). Note: this
 * keeps the *screen* awake — true locked-screen audio needs the native wrapper
 * tracked in #25.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/client/api";
import type { VoiceSignal } from "./signalHub";

export interface VoicePeer {
  id: string;
  name: string;
  state: RTCPeerConnectionState;
}

export interface UseVoiceChannel {
  micReady: boolean;
  secure: boolean;
  error: string | null;
  talking: boolean;
  peers: VoicePeer[];
  pttDown: () => void;
  pttUp: () => void;
}

const ICE_CONFIG: RTCConfiguration = { iceServers: [] }; // host candidates only — LAN/offline

async function postSignal(
  channel: string,
  msg: Record<string, unknown>,
): Promise<void> {
  const token = getToken();
  await fetch("/api/voice/signal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ channel, ...msg }),
  }).catch(() => {});
}

async function postTalk(
  channel: string,
  name: string,
  talking: boolean,
): Promise<void> {
  const token = getToken();
  await fetch("/api/voice/talk", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ channel, name, talking }),
  }).catch(() => {});
}

export function useVoiceChannel(opts: {
  operatorId: string;
  name: string;
  channel: string;
  enabled: boolean;
}): UseVoiceChannel {
  const { operatorId, name, channel, enabled } = opts;

  const [micReady, setMicReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [talking, setTalking] = useState(false);
  const [peers, setPeers] = useState<VoicePeer[]>([]);
  const [secure] = useState(() =>
    typeof window === "undefined" ? true : window.isSecureContext,
  );

  const localStream = useRef<MediaStream | null>(null);
  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const names = useRef<Map<string, string>>(new Map());
  const pendingIce = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const audioEls = useRef<Map<string, HTMLAudioElement>>(new Map());

  const syncPeers = useCallback(() => {
    setPeers(
      [...pcs.current.entries()].map(([id, pc]) => ({
        id,
        name: names.current.get(id) ?? id.slice(0, 6),
        state: pc.connectionState,
      })),
    );
  }, []);

  // ---- Mic: acquire once while enabled, keep across channel switches -------
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    if (typeof window !== "undefined" && !window.isSecureContext) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("Microphone needs HTTPS (works on localhost). LAN HTTPS is tracked in #23.");
      return;
    }
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getAudioTracks().forEach((t) => (t.enabled = false)); // PTT: muted until held
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStream.current = stream;
        setMicReady(true);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(`Mic unavailable: ${(err as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
      localStream.current?.getTracks().forEach((t) => t.stop());
      localStream.current = null;
      setMicReady(false);
      setTalking(false);
    };
  }, [enabled]);

  // ---- Signaling + mesh: rebuilds on channel switch ------------------------
  useEffect(() => {
    if (!enabled || !micReady || !channel) return;

    const peerMap = pcs.current;
    const audioMap = audioEls.current;
    const nameMap = names.current;
    const iceMap = pendingIce.current;

    const getOrCreatePeer = (peerId: string): RTCPeerConnection => {
      const existing = peerMap.get(peerId);
      if (existing) return existing;
      const pc = new RTCPeerConnection(ICE_CONFIG);
      localStream.current?.getTracks().forEach((t) => pc.addTrack(t, localStream.current!));
      pc.onicecandidate = (e) => {
        if (e.candidate) void postSignal(channel, { kind: "ice", to: peerId, payload: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        let el = audioMap.get(peerId);
        if (!el) {
          el = new Audio();
          el.autoplay = true;
          audioMap.set(peerId, el);
        }
        el.srcObject = e.streams[0];
        el.play().catch(() => {});
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          peerMap.delete(peerId);
        }
        syncPeers();
      };
      peerMap.set(peerId, pc);
      syncPeers();
      return pc;
    };

    const makeOffer = async (peerId: string) => {
      const pc = getOrCreatePeer(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      void postSignal(channel, { kind: "offer", to: peerId, payload: offer });
    };

    const flushIce = async (peerId: string, pc: RTCPeerConnection) => {
      const queued = iceMap.get(peerId);
      if (!queued) return;
      for (const c of queued) await pc.addIceCandidate(c).catch(() => {});
      iceMap.delete(peerId);
    };

    const handle = async (msg: VoiceSignal) => {
      switch (msg.kind) {
        case "welcome": {
          for (const p of msg.peers) {
            nameMap.set(p.id, p.name);
            // Smaller id offers, so exactly one side initiates per pair.
            if (operatorId < p.id) await makeOffer(p.id);
            else getOrCreatePeer(p.id);
          }
          break;
        }
        case "join": {
          nameMap.set(msg.id, msg.name);
          if (operatorId < msg.id) await makeOffer(msg.id);
          break;
        }
        case "leave": {
          peerMap.get(msg.id)?.close();
          peerMap.delete(msg.id);
          audioMap.get(msg.id)?.pause();
          audioMap.delete(msg.id);
          nameMap.delete(msg.id);
          syncPeers();
          break;
        }
        case "offer": {
          const pc = getOrCreatePeer(msg.from);
          await pc.setRemoteDescription(msg.payload as RTCSessionDescriptionInit);
          await flushIce(msg.from, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          void postSignal(channel, { kind: "answer", to: msg.from, payload: answer });
          break;
        }
        case "answer": {
          const pc = peerMap.get(msg.from);
          if (pc) {
            await pc.setRemoteDescription(msg.payload as RTCSessionDescriptionInit);
            await flushIce(msg.from, pc);
          }
          break;
        }
        case "ice": {
          const pc = peerMap.get(msg.from);
          const cand = msg.payload as RTCIceCandidateInit;
          if (pc?.remoteDescription) {
            await pc.addIceCandidate(cand).catch(() => {});
          } else {
            const q = iceMap.get(msg.from) ?? [];
            q.push(cand);
            iceMap.set(msg.from, q);
          }
          break;
        }
      }
    };

    const token = getToken() ?? "";
    const qs = new URLSearchParams({ channel, token, name });
    const es = new EventSource(`/api/voice/signal?${qs}`);
    es.onmessage = (e) => {
      try {
        void handle(JSON.parse(e.data) as VoiceSignal);
      } catch {
        /* keepalive comment lines */
      }
    };

    return () => {
      es.close();
      for (const pc of peerMap.values()) pc.close();
      peerMap.clear();
      for (const el of audioMap.values()) el.pause();
      audioMap.clear();
      nameMap.clear();
      iceMap.clear();
      setPeers([]);
    };
  }, [enabled, micReady, channel, operatorId, name, syncPeers]);

  // ---- Screen wake lock while enabled --------------------------------------
  useEffect(() => {
    if (!enabled) return;
    type WakeLockNav = Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    const wl = (navigator as WakeLockNav).wakeLock;
    if (!wl) return;
    let sentinel: { release: () => Promise<void> } | null = null;
    let released = false;
    const acquire = async () => {
      try {
        sentinel = await wl.request("screen");
      } catch {
        /* lock denied (e.g. tab not visible) — best effort */
      }
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible" && !released) void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [enabled]);

  const pttDown = useCallback(() => {
    if (!micReady || talking) return;
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = true));
    setTalking(true);
    void postTalk(channel, name, true);
  }, [micReady, talking, channel, name]);

  const pttUp = useCallback(() => {
    if (!talking) return;
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = false));
    setTalking(false);
    void postTalk(channel, name, false);
  }, [talking, channel, name]);

  return { micReady, secure, error, talking, peers, pttDown, pttUp };
}
