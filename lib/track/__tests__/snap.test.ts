import { describe, it, expect } from "vitest";
import { findSnap, type CanvasEndplate } from "../snap";

const ep = (
  placementId: string,
  endplateId: string,
  x: number,
  y: number,
  config: "single" | "double" | null = "single",
): CanvasEndplate => ({ placementId, endplateId, x, y, config });

describe("findSnap", () => {
  it("returns the nearest opposing endplate within the radius", () => {
    const drag = [ep("m", "B", 100, 0), ep("m", "A", 0, 0)];
    const targets = [ep("n", "A", 103, 1), ep("p", "A", 200, 0)];
    const hit = findSnap(drag, targets, 6)!;
    expect(hit.drag.endplateId).toBe("B");
    expect(hit.target.placementId).toBe("n");
    expect(hit.compatible).toBe(true);
  });

  it("returns null when nothing is within the radius", () => {
    expect(findSnap([ep("m", "B", 0, 0)], [ep("n", "A", 50, 0)], 6)).toBeNull();
  });

  it("flags a single↔double pair as incompatible but still snaps", () => {
    const hit = findSnap(
      [ep("m", "B", 0, 0, "single")],
      [ep("n", "A", 2, 0, "double")],
      6,
    )!;
    expect(hit).not.toBeNull();
    expect(hit.compatible).toBe(false);
  });

  it("never snaps an endplate to its own module", () => {
    expect(findSnap([ep("m", "B", 0, 0)], [ep("m", "A", 1, 0)], 6)).toBeNull();
  });

  it("picks the closest of several candidates", () => {
    const hit = findSnap(
      [ep("m", "B", 0, 0)],
      [ep("n", "A", 5, 0), ep("p", "A", 2, 0)],
      6,
    )!;
    expect(hit.target.placementId).toBe("p");
  });
});
