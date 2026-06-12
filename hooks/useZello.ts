"use client";

import { useContext } from "react";
import { ZelloContext } from "@/lib/zello/ZelloContext";
import type { ZelloContextValue } from "@/lib/zello/types";

/** Convenience hook for the Zello context (spec file manifest hooks/useZello). */
export function useZello(): ZelloContextValue {
  const ctx = useContext(ZelloContext);
  if (!ctx) throw new Error("useZello must be used within a ZelloProvider");
  return ctx;
}
