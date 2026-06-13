/**
 * Voice talk indicator (production).
 *
 *   POST /api/voice/talk   { channel, talking }   Bearer token
 *
 * Broadcasts a coarse `voice_talk` FdEvent ("operator X is/isn't talking on
 * channel Y") to every connected client so the in-channel roster, dispatchers,
 * and the Admin dashboard all see who is speaking. Ephemeral: live-only, never
 * written to ops_log (PTT churn has no audit value). The audio itself flows
 * peer-to-peer over WebRTC; this is presence only.
 */
import { tokenFromRequest } from "@/lib/server/sessionToken";
import { roleCanAccess } from "@/lib/voice/channels";
import { sessionManager } from "@/lib/server/SessionManager";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const claims = tokenFromRequest(req);
  if (!claims) return new Response("unauthorized", { status: 401 });

  let body: { channel?: string; talking?: boolean; name?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }
  if (!body?.channel || typeof body.talking !== "boolean") {
    return new Response("missing channel/talking", { status: 400 });
  }
  if (!roleCanAccess(claims.role, body.channel)) {
    return new Response("forbidden channel", { status: 403 });
  }

  sessionManager.broadcastEphemeral({
    type: "voice_talk",
    operatorId: claims.operatorId,
    name: body.name?.slice(0, 60) || "operator",
    channel: body.channel,
    talking: body.talking,
  });
  return new Response(null, { status: 204 });
}
