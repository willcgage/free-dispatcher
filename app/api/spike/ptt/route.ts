/**
 * WebRTC PTT spike — signaling endpoint (SPIKE, not production).
 *
 *   GET  /api/spike/ptt?room=<room>&id=<peerId>&name=<name>
 *        Server-Sent Events stream carrying signaling for one peer.
 *   POST /api/spike/ptt
 *        Body = a PttSignal; relayed to the target peer (or room) via the hub.
 *
 * Isolated from the production /api/events stream on purpose — see pttSignalHub.
 */
import { pttSignalHub, type PttSignal } from "@/lib/spike/pttSignalHub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KEEPALIVE_MS = 20_000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const room = url.searchParams.get("room") || "spike";
  const id = url.searchParams.get("id");
  const name = url.searchParams.get("name") || "anon";
  if (!id) return new Response("missing id", { status: 400 });

  let registration: { remove: () => void } | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`: connected\n\n`));
      registration = pttSignalHub.add(room, id, name, controller);

      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed; cleanup runs on abort */
        }
      }, KEEPALIVE_MS);

      req.signal.addEventListener("abort", () => {
        if (keepalive) clearInterval(keepalive);
        registration?.remove();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      if (keepalive) clearInterval(keepalive);
      registration?.remove();
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
  let body: (PttSignal & { room?: string }) | null = null;
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }
  if (!body || !("kind" in body)) {
    return new Response("missing kind", { status: 400 });
  }
  const room = body.room || "spike";
  pttSignalHub.relay(room, body);
  return new Response(null, { status: 204 });
}
