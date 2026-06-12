/**
 * GET /api/events — Server-Sent Events stream (spec §5.1).
 *
 * Every connected client subscribes here on session join. The server pushes
 * FdEvents via SessionManager.broadcast(). A periodic keepalive comment holds
 * the connection open through proxies. Verify locally with:
 *   curl --no-buffer http://localhost:3000/api/events
 */
import { sessionManager } from "@/lib/server/SessionManager";

export const dynamic = "force-dynamic";
// Node runtime (SessionManager uses the PGlite/db singleton).
export const runtime = "nodejs";

const KEEPALIVE_MS = 25_000;

export async function GET(req: Request) {
  let registration: { id: string; remove: () => void } | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      // Initial comment so the client's onopen fires immediately.
      controller.enqueue(encoder.encode(`: connected\n\n`));
      registration = sessionManager.addClient(controller);

      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed; cleanup runs on abort */
        }
      }, KEEPALIVE_MS);

      // Clean up when the client disconnects.
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
