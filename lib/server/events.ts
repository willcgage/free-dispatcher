/**
 * Server-Sent Event contract (spec §5.1). These are the events the server
 * pushes to all connected clients over `/api/events`.
 */
import type { OperatorRole, TrainStatus } from "@/lib/db/schema";

export type FdEvent =
  | { type: "session_start"; sessionId: string }
  | {
      type: "train_status_changed";
      trainId: string;
      status: TrainStatus;
      location: string | null;
      hasAuthority: boolean;
    }
  | { type: "operator_joined"; name: string; role: OperatorRole; deviceId: string }
  | { type: "operator_left"; deviceId: string }
  | { type: "authority_granted"; trainId: string; segment: string | null; grantedBy: string | null }
  | { type: "authority_revoked"; trainId: string | null; segment: string | null }
  | { type: "emergency_stop" }
  | { type: "session_message"; message: string }
  // Coarse voice presence for session-wide / admin visibility. The actual
  // WebRTC negotiation rides a separate signaling hub (lib/voice/signalHub);
  // this only says "operator X is/ isn't talking on channel Y". Ephemeral —
  // broadcast live but not persisted to ops_log (see broadcastEphemeral).
  | {
      type: "voice_talk";
      operatorId: string;
      name: string;
      channel: string;
      talking: boolean;
    };

export type FdEventType = FdEvent["type"];
