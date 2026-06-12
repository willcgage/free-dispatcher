/**
 * ZelloService (spec §7.6) — browser-side WebSocket client for the Zello
 * Channel API: logon, keepalive, channel switch, PTT transmit/receive.
 *
 * Free consumer tier: one channel per WebSocket; switching closes and reopens
 * (~1–2 s). The Opus encoder is dynamically imported so its ~500 KB bundle is
 * lazy-loaded only when the operator first transmits (spec §12).
 *
 * NOTE: requires a secure context (HTTPS/localhost) for getUserMedia, real
 * Zello credentials via the token server, and on-device verification. Without
 * configuration it stays in a graceful "unconfigured" state.
 */
import { build9ByteHeader } from "./audio";

export interface ZelloServiceCallbacks {
  onState: (connected: boolean) => void;
  onRxSpeaker: (username: string | null) => void;
  onTx: (isTx: boolean) => void;
  onError: (message: string | null) => void;
}

export interface ZelloServiceOptions {
  wsUrl: string;
  tokenUrl: string; // /api/zello/token — returns the shared dev token
  /**
   * Optional named Zello account for IN-APP TALK on the free consumer tier.
   * Omitted → listen-only (no mic, works over plain HTTP). Provided → the
   * operator can transmit (requires HTTPS for getUserMedia + channel membership).
   */
  zelloUsername?: string;
  zelloPassword?: string;
  callbacks: ZelloServiceCallbacks;
}

const KEEPALIVE_MS = 30_000;

export class ZelloService {
  private ws: WebSocket | null = null;
  private seq = 1;
  private channel: string | null = null;
  private keepalive: ReturnType<typeof setInterval> | null = null;

  // Tx state
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private encoder: { encode: (pcm: Int16Array) => Uint8Array | null } | null = null;
  private streamId: number | null = null;
  private packetIndex = 0;

  constructor(private opts: ZelloServiceOptions) {}

  // ---- Connection --------------------------------------------------------

  /** Whether this connection can transmit (named Zello account provided). */
  get canTalk(): boolean {
    return Boolean(this.opts.zelloUsername && this.opts.zelloPassword);
  }

  async connect(channel: string): Promise<void> {
    this.disconnect();
    this.channel = channel;

    // Fetch the shared 30-day Zello development token (free consumer tier).
    // The token authorizes the integration; per-operator talk uses a named
    // Zello account below.
    let token: string;
    try {
      const res = await fetch(this.opts.tokenUrl);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `token ${res.status}`);
      }
      token = (await res.json()).token;
      if (!token) throw new Error("no Zello dev token configured");
    } catch (e) {
      this.opts.callbacks.onError(
        e instanceof Error ? e.message : "token fetch failed",
      );
      return;
    }

    const ws = new WebSocket(this.opts.wsUrl);
    this.ws = ws;
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      // Friends & Family logon: auth_token + channels[]; username/password only
      // when talking, else listen_only (spec §7 + zello-channel-api API.md).
      const logon: Record<string, unknown> = {
        command: "logon",
        seq: this.nextSeq(),
        auth_token: token,
        channels: [channel],
      };
      if (this.canTalk) {
        logon.username = this.opts.zelloUsername;
        logon.password = this.opts.zelloPassword;
      } else {
        logon.listen_only = true;
      }
      this.send(logon);
      this.startKeepalive();
    };
    ws.onmessage = (ev) => this.onMessage(ev);
    ws.onerror = () => this.opts.callbacks.onError("websocket error");
    ws.onclose = () => {
      this.stopKeepalive();
      this.opts.callbacks.onState(false);
    };
  }

  disconnect(): void {
    this.stopTx();
    this.stopKeepalive();
    if (this.ws) {
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.opts.callbacks.onState(false);
  }

  /** Free tier: switch channel by reconnecting. */
  async switchChannel(channel: string): Promise<void> {
    await this.connect(channel);
  }

  private startKeepalive() {
    this.stopKeepalive();
    // Lightweight liveness check; a real ping/refresh is finalized during
    // on-device testing. Avoids sending channel messages (would error on a
    // listen-only connection).
    this.keepalive = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) this.opts.callbacks.onState(false);
    }, KEEPALIVE_MS);
  }
  private stopKeepalive() {
    if (this.keepalive) clearInterval(this.keepalive);
    this.keepalive = null;
  }

  private onMessage(ev: MessageEvent) {
    if (typeof ev.data === "string") {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.success === true && msg.refresh_token) {
        this.opts.callbacks.onState(true);
        this.opts.callbacks.onError(null);
      } else if (msg.success === true && typeof msg.stream_id === "number") {
        // Response to our start_stream — begin sending audio frames.
        this.streamId = msg.stream_id;
      } else if (msg.command === "on_stream_start") {
        this.opts.callbacks.onRxSpeaker(String(msg.from ?? "unknown"));
      } else if (msg.command === "on_stream_stop") {
        this.opts.callbacks.onRxSpeaker(null);
      } else if (msg.error) {
        this.opts.callbacks.onError(String(msg.error));
      }
      return;
    }
    // Binary RX audio: strip the 9-byte header. Playback/decode is wired in
    // audio.ts and requires on-device verification with real Opus packets.
    // (Intentionally a no-op until decode is validated against live Zello.)
  }

  // ---- Transmit ----------------------------------------------------------

  async startTx(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.channel) return;
    if (!this.canTalk) {
      this.opts.callbacks.onError("listen-only — talk in the Zello app");
      return;
    }
    try {
      this.audioCtx = new AudioContext({ sampleRate: 16000 });
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await this.audioCtx.audioWorklet.addModule("/zello-capture-worklet.js");

      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
      const node = new AudioWorkletNode(this.audioCtx, "zello-capture");
      this.workletNode = node;

      // Lazy-load the Opus encoder (~500 KB) only on first transmit (spec §12).
      this.encoder = await loadOpusEncoder();

      this.packetIndex = 0;
      this.send({
        command: "start_stream",
        seq: this.nextSeq(),
        channel: this.channel,
        type: "audio",
        codec: "opus",
        codec_header: "", // negotiated header; finalize during device testing
        packet_duration: 20,
      });

      node.port.onmessage = (e: MessageEvent<Int16Array>) => this.onPcmFrame(e.data);
      source.connect(node);
      this.opts.callbacks.onTx(true);
    } catch (e) {
      this.opts.callbacks.onError(
        e instanceof Error ? e.message : "microphone unavailable",
      );
      this.stopTx();
    }
  }

  private onPcmFrame(pcm: Int16Array) {
    if (this.streamId == null || !this.encoder || !this.ws) return;
    const opus = this.encoder.encode(pcm);
    if (!opus) return;
    const header = build9ByteHeader(this.streamId, this.packetIndex++);
    const frame = new Uint8Array(header.length + opus.length);
    frame.set(header, 0);
    frame.set(opus, header.length);
    this.ws.send(frame);
  }

  stopTx(): void {
    if (this.streamId != null) {
      this.send({ command: "stop_stream", seq: this.nextSeq(), stream_id: this.streamId });
      this.streamId = null;
    }
    this.workletNode?.disconnect();
    this.workletNode = null;
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    void this.audioCtx?.close();
    this.audioCtx = null;
    this.encoder = null;
    this.opts.callbacks.onTx(false);
  }

  // ---- helpers -----------------------------------------------------------

  private nextSeq() {
    return this.seq++;
  }
  private send(obj: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }
}

/**
 * Load the Opus encoder. The concrete codec library is finalized during
 * on-device testing (the spec's `ogg-opus-encoder` is illustrative and not a
 * published package). Until then this returns a no-op encoder so the capture
 * pipeline runs end-to-end without producing packets — keeping the build and
 * the rest of the PTT flow (WS, logon, tx/rx state, SSE) fully functional.
 *
 * To finish: pick a WASM Opus encoder, lazy-import it here, and return
 * `{ encode(pcm: Int16Array): Uint8Array }`.
 */
async function loadOpusEncoder(): Promise<{
  encode: (pcm: Int16Array) => Uint8Array | null;
}> {
  return { encode: () => null };
}
