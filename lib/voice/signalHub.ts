/**
 * Voice signaling hub (production) — WebRTC negotiation relay.
 *
 * Graduated from the `/spike/ptt` proof (`lib/spike/pttSignalHub`). Carries
 * only the media-negotiation messages (SDP offer/answer + ICE + peer
 * presence) over the app's "SSE down + POST up" pattern. It is deliberately
 * kept OFF the `FdEvent` / `/api/events` contract: this is a high-frequency,
 * peer-to-peer firehose that the rest of the app should never see. Coarse
 * "who is talking" presence is a separate `voice_talk` FdEvent instead.
 *
 * Rooms are `${sessionId}:${channel}` (see `roomId`), so signaling is scoped
 * per session and per channel. Peer ids are operator ids (stable, from the
 * verified session token), which lets talk indicators map straight to peers.
 *
 * Topology: full mesh (one RTCPeerConnection per other peer). PTT is one
 * talker per channel, so media load stays light; a server SFU/relay can
 * replace mesh later without touching this signaling shape.
 */

export type VoiceSignal =
  | { kind: "welcome"; id: string; peers: { id: string; name: string }[] }
  | { kind: "join"; id: string; name: string }
  | { kind: "leave"; id: string }
  | { kind: "offer"; from: string; to: string; payload: unknown }
  | { kind: "answer"; from: string; to: string; payload: unknown }
  | { kind: "ice"; from: string; to: string; payload: unknown };

type Peer = {
  id: string;
  name: string;
  room: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
};

class VoiceSignalHub {
  private peers = new Map<string, Peer>();
  private encoder = new TextEncoder();

  /**
   * Register a subscribing peer (keyed by room+id so the same operator can be
   * on different channels in different tabs). Returns an unregister function.
   */
  add(
    room: string,
    id: string,
    name: string,
    controller: ReadableStreamDefaultController<Uint8Array>,
  ): { remove: () => void } {
    const key = `${room} ${id}`;
    this.peers.set(key, { id, name, room, controller });
    // Tell the newcomer who is already here.
    this.sendTo(room, id, {
      kind: "welcome",
      id,
      peers: this.peersInRoom(room, id).map((p) => ({ id: p.id, name: p.name })),
    });
    // Tell everyone else the newcomer arrived.
    this.broadcast(room, { kind: "join", id, name }, id);
    return {
      remove: () => {
        this.peers.delete(key);
        this.broadcast(room, { kind: "leave", id }, id);
      },
    };
  }

  private peersInRoom(room: string, exceptId?: string): Peer[] {
    return [...this.peers.values()].filter(
      (p) => p.room === room && p.id !== exceptId,
    );
  }

  /** Relay a negotiation message — to one peer if `to` is set, else broadcast. */
  relay(room: string, msg: VoiceSignal): void {
    if ("to" in msg && msg.to) {
      this.sendTo(room, msg.to, msg);
    } else if ("from" in msg) {
      this.broadcast(room, msg, msg.from);
    } else {
      this.broadcast(room, msg);
    }
  }

  private sendTo(room: string, id: string, msg: VoiceSignal): void {
    const peer = this.peers.get(`${room} ${id}`);
    if (peer) this.write(peer, msg);
  }

  private broadcast(room: string, msg: VoiceSignal, exceptId?: string): void {
    for (const peer of this.peers.values()) {
      if (peer.room === room && peer.id !== exceptId) this.write(peer, msg);
    }
  }

  private write(peer: Peer, msg: VoiceSignal): void {
    const frame = `data: ${JSON.stringify(msg)}\n\n`;
    try {
      peer.controller.enqueue(this.encoder.encode(frame));
    } catch {
      this.peers.delete(`${peer.room} ${peer.id}`);
    }
  }
}

// Reused across HMR via globalThis, mirroring the db / SessionManager singletons.
const globalForHub = globalThis as unknown as {
  __fdVoiceSignalHub?: VoiceSignalHub;
};

export const voiceSignalHub =
  globalForHub.__fdVoiceSignalHub ?? new VoiceSignalHub();

if (process.env.NODE_ENV !== "production") {
  globalForHub.__fdVoiceSignalHub = voiceSignalHub;
}
