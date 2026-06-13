"use client";

/**
 * WebRTC PTT spike (SPIKE, not production) — /spike/ptt
 *
 * Proves Option A end to end in the browser: getUserMedia → WebRTC mesh →
 * Opus (WebRTC default) → push-to-talk gating, with all signaling carried over
 * the app's existing "SSE down + POST up" pattern (see /api/spike/ptt).
 *
 * How to test: open this page in two browsers/devices on the same LAN, Join in
 * both, then hold the PTT button (or Space). Mic needs a secure context — works
 * on localhost; on a phone over the LAN IP it needs HTTPS (the planned Q2 work).
 *
 * Mesh is fine for a 2–handful peer proof; production would use a server
 * SFU/relay, but the browser/signaling/mic/Opus path validated here is the same.
 */
import { useCallback, useEffect, useRef, useState } from "react";

type SignalMsg =
  | { kind: "welcome"; id: string; peers: string[] }
  | { kind: "join"; id: string; name: string }
  | { kind: "leave"; id: string }
  | { kind: "offer"; from: string; to: string; payload: RTCSessionDescriptionInit }
  | { kind: "answer"; from: string; to: string; payload: RTCSessionDescriptionInit }
  | { kind: "ice"; from: string; to: string; payload: RTCIceCandidateInit }
  | { kind: "talk-start"; from: string; name: string }
  | { kind: "talk-stop"; from: string };

type PeerView = { id: string; name: string; state: string; talking: boolean };

const ICE_CONFIG: RTCConfiguration = { iceServers: [] }; // host candidates only — LAN/offline

export default function PttSpikePage() {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("spike");
  const [joined, setJoined] = useState(false);
  const [talking, setTalking] = useState(false);
  const [peers, setPeers] = useState<PeerView[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [secure] = useState(() => (typeof window === "undefined" ? true : window.isSecureContext));

  const myId = useRef<string>("");
  const localStream = useRef<MediaStream | null>(null);
  const es = useRef<EventSource | null>(null);
  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const names = useRef<Map<string, string>>(new Map());
  const pendingIce = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const audioEls = useRef<Map<string, HTMLAudioElement>>(new Map());

  const append = useCallback((line: string) => {
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${line}`, ...l].slice(0, 60));
  }, []);

  const syncPeers = useCallback(() => {
    const talkingNow = new Set(
      [...names.current.keys()].filter((id) => audioEls.current.get(id)?.dataset.talking === "1"),
    );
    setPeers(
      [...pcs.current.entries()].map(([id, pc]) => ({
        id,
        name: names.current.get(id) ?? id.slice(0, 6),
        state: pc.connectionState,
        talking: talkingNow.has(id),
      })),
    );
  }, []);

  const post = useCallback(
    (msg: Record<string, unknown>) =>
      fetch("/api/spike/ptt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room, from: myId.current, ...msg }),
      }).catch(() => {}),
    [room],
  );

  const getOrCreatePeer = useCallback(
    (peerId: string): RTCPeerConnection => {
      const existing = pcs.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(ICE_CONFIG);
      localStream.current?.getTracks().forEach((t) => pc.addTrack(t, localStream.current!));

      pc.onicecandidate = (e) => {
        if (e.candidate) post({ kind: "ice", to: peerId, payload: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        let el = audioEls.current.get(peerId);
        if (!el) {
          el = new Audio();
          el.autoplay = true;
          audioEls.current.set(peerId, el);
        }
        el.srcObject = e.streams[0];
        el.play().catch(() => append(`audio play blocked for ${peerId.slice(0, 6)} (gesture needed)`));
      };
      pc.onconnectionstatechange = () => {
        append(`peer ${peerId.slice(0, 6)}: ${pc.connectionState}`);
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          pcs.current.delete(peerId);
        }
        syncPeers();
      };

      pcs.current.set(peerId, pc);
      syncPeers();
      return pc;
    },
    [post, append, syncPeers],
  );

  const makeOffer = useCallback(
    async (peerId: string) => {
      const pc = getOrCreatePeer(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      post({ kind: "offer", to: peerId, payload: offer });
      append(`-> offer to ${peerId.slice(0, 6)}`);
    },
    [getOrCreatePeer, post, append],
  );

  const flushIce = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queued = pendingIce.current.get(peerId);
    if (!queued) return;
    for (const c of queued) await pc.addIceCandidate(c).catch(() => {});
    pendingIce.current.delete(peerId);
  }, []);

  const handleSignal = useCallback(
    async (msg: SignalMsg) => {
      switch (msg.kind) {
        case "welcome": {
          myId.current = msg.id;
          append(`welcome — ${msg.peers.length} peer(s) already here`);
          // Smaller id is the offerer, so exactly one side offers per pair.
          for (const peerId of msg.peers) {
            if (myId.current < peerId) await makeOffer(peerId);
            else getOrCreatePeer(peerId);
          }
          break;
        }
        case "join": {
          names.current.set(msg.id, msg.name);
          append(`${msg.name} joined`);
          if (myId.current < msg.id) await makeOffer(msg.id);
          break;
        }
        case "leave": {
          append(`${names.current.get(msg.id) ?? msg.id.slice(0, 6)} left`);
          pcs.current.get(msg.id)?.close();
          pcs.current.delete(msg.id);
          audioEls.current.get(msg.id)?.pause();
          audioEls.current.delete(msg.id);
          names.current.delete(msg.id);
          syncPeers();
          break;
        }
        case "offer": {
          const pc = getOrCreatePeer(msg.from);
          await pc.setRemoteDescription(msg.payload);
          await flushIce(msg.from, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          post({ kind: "answer", to: msg.from, payload: answer });
          append(`<- offer from ${msg.from.slice(0, 6)}, sent answer`);
          break;
        }
        case "answer": {
          const pc = pcs.current.get(msg.from);
          if (pc) {
            await pc.setRemoteDescription(msg.payload);
            await flushIce(msg.from, pc);
            append(`<- answer from ${msg.from.slice(0, 6)}`);
          }
          break;
        }
        case "ice": {
          const pc = pcs.current.get(msg.from);
          if (pc?.remoteDescription) {
            await pc.addIceCandidate(msg.payload).catch(() => {});
          } else {
            const q = pendingIce.current.get(msg.from) ?? [];
            q.push(msg.payload);
            pendingIce.current.set(msg.from, q);
          }
          break;
        }
        case "talk-start": {
          const el = audioEls.current.get(msg.from);
          if (el) el.dataset.talking = "1";
          names.current.set(msg.from, msg.name);
          syncPeers();
          break;
        }
        case "talk-stop": {
          const el = audioEls.current.get(msg.from);
          if (el) el.dataset.talking = "0";
          syncPeers();
          break;
        }
      }
    },
    [append, makeOffer, getOrCreatePeer, flushIce, post, syncPeers],
  );

  const join = useCallback(async () => {
    if (!window.isSecureContext) {
      append("not a secure context — mic blocked (use localhost or HTTPS)");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getAudioTracks().forEach((t) => (t.enabled = false)); // PTT: muted until held
      localStream.current = stream;
      append("mic acquired (muted until PTT held)");
    } catch (err) {
      append(`getUserMedia failed: ${(err as Error).message}`);
      return;
    }

    const id = crypto.randomUUID();
    myId.current = id;
    const qs = new URLSearchParams({ room, id, name: name || "anon" });
    const source = new EventSource(`/api/spike/ptt?${qs}`);
    es.current = source;
    source.onopen = () => append("signaling connected");
    source.onerror = () => append("signaling error/closed");
    source.onmessage = (e) => {
      try {
        handleSignal(JSON.parse(e.data) as SignalMsg);
      } catch {
        /* ignore non-JSON keepalives */
      }
    };
    setJoined(true);
  }, [room, name, append, handleSignal]);

  const leave = useCallback(() => {
    es.current?.close();
    pcs.current.forEach((pc) => pc.close());
    pcs.current.clear();
    audioEls.current.forEach((el) => el.pause());
    audioEls.current.clear();
    names.current.clear();
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    setJoined(false);
    setPeers([]);
    append("left");
  }, [append]);

  const pttDown = useCallback(() => {
    if (!joined || talking) return;
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = true));
    setTalking(true);
    post({ kind: "talk-start", name: name || "anon" });
  }, [joined, talking, post, name]);

  const pttUp = useCallback(() => {
    if (!talking) return;
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = false));
    setTalking(false);
    post({ kind: "talk-stop" });
  }, [talking, post]);

  // Spacebar = PTT.
  useEffect(() => {
    if (!joined) return;
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        pttDown();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        pttUp();
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [joined, pttDown, pttUp]);

  useEffect(() => () => leave(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>WebRTC PTT spike</h1>
      <p style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
        Option A proof — getUserMedia → WebRTC mesh → push-to-talk over the app&apos;s SSE+POST
        signaling. Open in two browsers/devices on the same LAN, Join in both, then hold PTT.
      </p>

      {!secure && (
        <div style={{ background: "#fde8e8", color: "#9b1c1c", padding: 10, borderRadius: 8, marginTop: 12, fontSize: 13 }}>
          ⚠️ Not a secure context — the mic is blocked. Use <code>localhost</code> or HTTPS
          (the planned LAN-HTTPS / Q2 work) to test on a phone over the network.
        </div>
      )}

      {!joined ? (
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <input
            placeholder="your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, padding: 10, border: "1px solid #ccc", borderRadius: 8, minWidth: 120 }}
          />
          <input
            placeholder="room"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            style={{ width: 110, padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
          <button
            onClick={join}
            style={{ padding: "10px 18px", background: "#1d4ed8", color: "#fff", border: 0, borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
          >
            Join &amp; enable audio
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <button
            onPointerDown={pttDown}
            onPointerUp={pttUp}
            onPointerLeave={pttUp}
            style={{
              width: "100%",
              padding: "28px 0",
              fontSize: 20,
              fontWeight: 700,
              color: "#fff",
              background: talking ? "#16a34a" : "#374151",
              border: 0,
              borderRadius: 12,
              cursor: "pointer",
              touchAction: "none",
              userSelect: "none",
            }}
          >
            {talking ? "🎙 TALKING — release to stop" : "Hold to talk (or Space)"}
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
            <span style={{ fontSize: 13, color: "#666" }}>
              {peers.length} peer(s) · room <b>{room}</b>
            </span>
            <button onClick={leave} style={{ fontSize: 13, color: "#9b1c1c", background: "none", border: 0, cursor: "pointer" }}>
              Leave
            </button>
          </div>
        </div>
      )}

      {peers.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {peers.map((p) => (
            <li
              key={p.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, background: p.talking ? "#dcfce7" : "#f3f4f6", marginBottom: 6 }}
            >
              <span style={{ fontWeight: 600 }}>{p.talking ? "🔊 " : ""}{p.name}</span>
              <span style={{ fontSize: 12, color: p.state === "connected" ? "#16a34a" : "#a16207" }}>{p.state}</span>
            </li>
          ))}
        </ul>
      )}

      <details style={{ marginTop: 20 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "#666" }}>signaling log</summary>
        <pre style={{ fontSize: 11, color: "#444", background: "#f9fafb", padding: 10, borderRadius: 8, maxHeight: 220, overflow: "auto", marginTop: 8 }}>
          {log.join("\n")}
        </pre>
      </details>
    </main>
  );
}
