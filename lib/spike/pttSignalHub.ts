/**
 * WebRTC PTT spike — in-memory signaling hub (SPIKE, not production).
 *
 * A self-contained signaling relay used only by the `/spike/ptt` proof of
 * concept. It is deliberately isolated from SessionManager / the FdEvent
 * contract so the spike can be deleted in one commit. Validates that the
 * existing "SSE down + POST up" pattern is enough to carry WebRTC signaling
 * (SDP offer/answer + ICE) between browser peers on the LAN.
 *
 * Topology proven: full mesh. Each browser holds one RTCPeerConnection per
 * other peer; audio tracks are negotiated once and gated on/off by PTT. A
 * production build would swap mesh for a server SFU/relay, but the browser +
 * signaling + Opus + mic path this exercises is identical.
 */

export type PttSignal =
  | { kind: "welcome"; id: string; peers: string[] }
  | { kind: "join"; id: string; name: string }
  | { kind: "leave"; id: string }
  | { kind: "offer"; from: string; to: string; payload: unknown }
  | { kind: "answer"; from: string; to: string; payload: unknown }
  | { kind: "ice"; from: string; to: string; payload: unknown }
  | { kind: "talk-start"; from: string; name: string }
  | { kind: "talk-stop"; from: string };

type Peer = {
  id: string;
  name: string;
  room: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
};

class PttSignalHub {
  private peers = new Map<string, Peer>();
  private encoder = new TextEncoder();

  /** Register a subscribing peer; returns an unregister function. */
  add(
    room: string,
    id: string,
    name: string,
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): { remove: () => void } {
    this.peers.set(id, { id, name, room, controller });
    // Tell the newcomer who is already here.
    this.sendTo(id, {
      kind: "welcome",
      id,
      peers: this.peerIdsInRoom(room, id),
    });
    // Tell everyone else the newcomer arrived.
    this.broadcast(room, { kind: "join", id, name }, id);
    return {
      remove: () => {
        this.peers.delete(id);
        this.broadcast(room, { kind: "leave", id }, id);
      },
    };
  }

  private peerIdsInRoom(room: string, exceptId?: string): string[] {
    return [...this.peers.values()]
      .filter((p) => p.room === room && p.id !== exceptId)
      .map((p) => p.id);
  }

  /** Relay a signaling message — to one peer if `to` is set, else broadcast. */
  relay(room: string, msg: PttSignal): void {
    if ("to" in msg && msg.to) {
      this.sendTo(msg.to, msg);
    } else if ("from" in msg) {
      this.broadcast(room, msg, msg.from);
    } else {
      this.broadcast(room, msg);
    }
  }

  private sendTo(id: string, msg: PttSignal): void {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.write(peer, msg);
  }

  private broadcast(room: string, msg: PttSignal, exceptId?: string): void {
    for (const peer of this.peers.values()) {
      if (peer.room === room && peer.id !== exceptId) this.write(peer, msg);
    }
  }

  private write(peer: Peer, msg: PttSignal): void {
    const frame = `data: ${JSON.stringify(msg)}\n\n`;
    try {
      peer.controller.enqueue(this.encoder.encode(frame));
    } catch {
      this.peers.delete(peer.id);
    }
  }
}

// Reused across HMR via globalThis, mirroring the db / SessionManager singletons.
const globalForHub = globalThis as unknown as {
  __fdPttSignalHub?: PttSignalHub;
};

export const pttSignalHub =
  globalForHub.__fdPttSignalHub ?? new PttSignalHub();

if (process.env.NODE_ENV !== "production") {
  globalForHub.__fdPttSignalHub = pttSignalHub;
}
