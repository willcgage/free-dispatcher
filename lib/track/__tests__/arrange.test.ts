import { describe, it, expect } from "vitest";
import { applyXf, xfEndplate, ZERO_XF } from "../arrange";
import { findFaceSnap, type CanvasEndplate } from "../snap";

const ep = (
  placementId: string,
  endplateId: string,
  x: number,
  y: number,
  heading: number,
): CanvasEndplate => ({ placementId, endplateId, x, y, heading, config: "single" });

describe("applyXf", () => {
  it("is the identity for the zero transform", () => {
    expect(applyXf({ x: 5, y: -2 }, ZERO_XF, { x: 0, y: 0 })).toEqual({ x: 5, y: -2 });
  });

  it("rotates about the pivot, then translates", () => {
    // 90° about origin sends (1,0) → (0,1); then +(3,4).
    const p = applyXf({ x: 1, y: 0 }, { dx: 3, dy: 4, rot: 90 }, { x: 0, y: 0 });
    expect(p.x).toBeCloseTo(3);
    expect(p.y).toBeCloseTo(5);
  });

  it("leaves the pivot fixed under pure rotation", () => {
    const p = applyXf({ x: 2, y: 2 }, { dx: 0, dy: 0, rot: 137 }, { x: 2, y: 2 });
    expect(p.x).toBeCloseTo(2);
    expect(p.y).toBeCloseTo(2);
  });
});

describe("xfEndplate turns a face into mating range", () => {
  // A corner module's free face points NORTH (90°); the target face points
  // WEST (180°). They do NOT oppose, so nothing mates as-is…
  const cornerFace = ep("corner", "B", 0, 0, 90);
  const target = ep("straight", "A", 3, 0, 180);

  it("does not mate before rotating", () => {
    expect(findFaceSnap([cornerFace], [target], 8)).toBeNull();
  });

  it("mates once rotated so the face opposes the target", () => {
    // Rotate −90° about the face point: heading 90 → 0 (faces EAST), which
    // opposes the target's WEST-facing normal. Position stays within radius.
    const turned = xfEndplate(cornerFace, { dx: 0, dy: 0, rot: -90 }, { x: 0, y: 0 });
    expect(turned.heading).toBeCloseTo(0);
    const hit = findFaceSnap([turned], [target], 8);
    expect(hit).not.toBeNull();
    expect(hit!.target.placementId).toBe("straight");
    expect(hit!.compatible).toBe(true);
  });

  it("mates even at a partial rotation within the 40° tolerance", () => {
    // 60° of the needed 90° leaves the face 30° off opposing — inside tol.
    const turned = xfEndplate(cornerFace, { dx: 0, dy: 0, rot: -60 }, { x: 0, y: 0 });
    expect(findFaceSnap([turned], [target], 8)).not.toBeNull();
  });
});
