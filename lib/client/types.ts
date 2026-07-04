/** Shared client-facing shapes for session state (mirrors API responses). */
import type {
  SessionStatus,
  TrainStatus,
  DccType,
  EquipmentType,
  OperatorRole,
} from "@/lib/db/schema";

export interface SessionRow {
  id: string;
  name: string;
  date: string | null;
  venue: string | null;
  layoutId: string | null;
  layoutConfigId: string | null;
  status: SessionStatus;
  createdAt: string;
}

export interface TrainStatusRow {
  id: string;
  trainId: string;
  sessionId: string;
  status: TrainStatus;
  locationName: string | null;
  hasAuthority: boolean;
  updatedBy: string | null;
  updatedAt: string;
}

export interface TrainRow {
  id: string;
  sessionId: string;
  number: string;
  name: string | null;
  dccAddress: number | null;
  dccType: DccType | null;
  owner: string | null;
  consistId: string | null;
  equipmentType: EquipmentType | null;
  assignedOperatorId: string | null;
  createdAt: string;
  currentStatus: TrainStatusRow | null;
}

export interface OperatorRow {
  id: string;
  sessionId: string;
  name: string;
  role: OperatorRole;
  deviceId: string | null;
  joinedAt: string;
  leftAt: string | null;
}

export interface ModuleLayoutRow {
  id: string;
  layoutId: string;
  moduleId: string;
  positionIndex: number;
  stagingEnd: "A" | "B" | null;
  moduleName?: string | null;
}

/** A row from the local Module Repository catalog (GET /api/modules/catalog). */
export interface CatalogModule {
  recordNumber: string;
  moduleName: string;
  owner: string | null;
  category: string | null;
  geometryType: string | null;
  lengthTotalInches?: number | null;
  mainlineLengthInches?: number | null;
  endplateCount: number | null;
  hasMss: boolean | null;
}

export interface FullState {
  session: SessionRow | null;
  trains: TrainRow[];
  operators: OperatorRow[];
  modules: ModuleLayoutRow[];
  connectedCount?: number;
}

export interface OpsLogEntry {
  id: string;
  sessionId: string;
  eventType: string;
  payload: unknown;
  createdAt: string;
}
