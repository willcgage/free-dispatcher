/**
 * Server-Sent Event contract (spec §5.1). These are the events the server
 * pushes to all connected clients over `/api/events`.
 */
import type {
  OperatorRole,
  TrainStatus,
  SectionDirection,
  TurnoutPosition,
} from "@/lib/db/schema";

export type FdEvent =
  | { type: "session_start"; sessionId: string }
  | { type: "session_archived"; sessionId: string }
  | { type: "layout_changed"; layoutId: string | null }
  | {
      type: "block_occupancy_changed";
      blockId: string;
      occupied: boolean;
      trainId: string | null;
    }
  | {
      type: "section_allocated";
      allocationId: string;
      sectionId: string;
      trainId: string;
      direction: SectionDirection;
    }
  | {
      type: "section_released";
      allocationId: string;
      sectionId: string;
      trainId: string;
    }
  | { type: "turnout_changed"; turnoutId: string; position: TurnoutPosition }
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
  | { type: "session_message"; message: string };

export type FdEventType = FdEvent["type"];
