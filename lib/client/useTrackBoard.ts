/**
 * useTrackBoard — live track model for the dispatcher view (#80).
 *
 * Loads the active session's layout tree + runtime state (block occupancy,
 * section allocations), then keeps them live by subscribing to the track SSE
 * events. Self-contained so the board can render on any surface.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "./api";

export interface BlockNode {
  id: string;
  name: string;
  moduleRecordNumber: string | null;
}
export interface SectionNode {
  id: string;
  name: string;
  track: string | null;
  blocks: BlockNode[];
}
export interface DistrictNode {
  id: string;
  name: string;
  sections: SectionNode[];
}
export interface LayoutTree {
  id: string;
  name: string;
  districts: DistrictNode[];
}
export interface OccupancyRow {
  blockId: string;
  occupied: boolean;
  trainId: string | null;
}
export interface AllocationRow {
  id: string;
  sectionId: string;
  trainId: string;
  direction: "AtoB" | "BtoA";
}

const TRACK_EVENTS = [
  "block_occupancy_changed",
  "section_allocated",
  "section_released",
];
const SESSION_EVENTS = ["session_start", "session_archived"];

export interface UseTrackBoard {
  layout: LayoutTree | null;
  /** blockId → occupancy row (only present blocks). */
  occupancy: Record<string, OccupancyRow>;
  /** sectionId → active allocation. */
  allocations: Record<string, AllocationRow>;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useTrackBoard(): UseTrackBoard {
  const [layout, setLayout] = useState<LayoutTree | null>(null);
  const [occupancy, setOccupancy] = useState<Record<string, OccupancyRow>>({});
  const [allocations, setAllocations] = useState<Record<string, AllocationRow>>(
    {},
  );
  const [loading, setLoading] = useState(true);

  const loadState = useCallback(async () => {
    const st = await apiGet<{
      occupancy: OccupancyRow[];
      allocations: AllocationRow[];
    }>("/api/track/state");
    setOccupancy(Object.fromEntries(st.occupancy.map((o) => [o.blockId, o])));
    setAllocations(
      Object.fromEntries(st.allocations.map((a) => [a.sectionId, a])),
    );
  }, []);

  const loadLayout = useCallback(async () => {
    const s = await apiGet<{ session: { layoutId: string | null } | null }>(
      "/api/session",
    );
    const layoutId = s.session?.layoutId ?? null;
    if (!layoutId) {
      setLayout(null);
      return;
    }
    const { layout } = await apiGet<{ layout: LayoutTree }>(
      `/api/layouts/${layoutId}`,
    );
    setLayout(layout);
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadLayout(), loadState()]);
    setLoading(false);
  }, [loadLayout, loadState]);

  useEffect(() => {
    // Initial load + subscribe. refresh()/loadState() setState after an await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();

    const es = new EventSource("/api/events");
    const onTrack = () => void loadState();
    const onSession = () => void refresh();
    for (const t of TRACK_EVENTS) es.addEventListener(t, onTrack);
    for (const t of SESSION_EVENTS) es.addEventListener(t, onSession);

    return () => {
      for (const t of TRACK_EVENTS) es.removeEventListener(t, onTrack);
      for (const t of SESSION_EVENTS) es.removeEventListener(t, onSession);
      es.close();
    };
  }, [refresh, loadState]);

  return { layout, occupancy, allocations, loading, refresh };
}
