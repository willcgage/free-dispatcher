/**
 * Voice signaling endpoint (production) — WebRTC negotiation transport.
 *
 *   GET  /api/voice/signal?channel=<id>&token=<sessionToken>
 *        SSE stream of negotiation messages for this operator on this channel.
 *        (EventSource can't send an Authorization header, so the session token
 *        rides in the query string and is verified the same way.)
 *   POST /api/voice/signal   { channel, ...VoiceSignal }   Bearer token
 *        Relays one negotiation message to the target peer / channel.
 *
 * The peer id is the verified operatorId (never client-supplied), and the
 * channel is authorized against the operator's role (spec §4 RBAC). Kept off
 * the FdEvent contract on purpose — see lib/voice/signalHub.
 */
import { voiceSignalHub, type VoiceSignal } from "@/lib/voice/signalHub";
import { roleCanAccess, roomId } from "@/lib/voice/channels";
import { verifyToken, tokenFromRequest } from "@/lib/server/sessionToken";
import { sessionManager } from "@/lib/server/SessionManager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEEPALIVE_MS = 20_000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const channel = url.searchParams.get("channel") ?? "";
  const claims = verifyToken(url.searchParams.get("token"));
  if (!claims) return new Response("unauthorized", { status: 401 });
  if (!roleCanAccess(claims.role, channel)) {
    return new Response("forbidden channel", { status: 403 });
  }

  const room = roomId(claims.sessionId, channel);
  const id = claims.operatorId;
  const name = url.searchParams.get("name") || "operator";

  let registration: { remove: () => void } | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;
  let cleanedUp = false;

  // Runs once when the operator's signaling connection drops (tab closed,
  // navigated away, network died). Besides unregistering from the mesh, it
  // clears any stuck talk indicator: if the tab dies mid-PTT the client never
  // sends its talk-stop, so leaving the channel must implicitly stop talking.
  // Idempotent on clients (clearing an already-clear entry is a no-op).
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (keepalive) clearInterval(keepalive);
    registration?.remove();
    sessionManager.broadcastEphemeral({
      type: "voice_talk",
      operatorId: id,
      name,
      channel,
      talking: false,
    });
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`: connected\n\n`));
      registration = voiceSignalHub.add(room, id, name, controller);

      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed; cleanup runs on abort */
        }
      }, KEEPALIVE_MS);

      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(req: Request) {
  const claims = tokenFromRequest(req);
  if (!claims) return new Response("unauthorized", { status: 401 });

  let body: (VoiceSignal & { channel?: string }) | null = null;
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }
  if (!body || !("kind" in body) || !body.channel) {
    return new Response("missing kind/channel", { status: 400 });
  }
  if (!roleCanAccess(claims.role, body.channel)) {
    return new Response("forbidden channel", { status: 403 });
  }
  // Pin `from` to the verified operator so peers can't be spoofed. (The
  // routing-only `channel` field rides along in the frame; peers ignore it.)
  const msg = { ...body, from: claims.operatorId } as VoiceSignal;
  voiceSignalHub.relay(roomId(claims.sessionId, body.channel), msg);
  return new Response(null, { status: 204 });
}
