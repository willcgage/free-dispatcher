import { describe, it, expect } from "vitest";
import { flushMatePose, applyMatePose, matedHeading } from "../mate";

describe("flushMatePose lands endplates flush from any angle", () => {
  it("mates two already-opposing faces (no rotation needed)", () => {
    const drag = { x: 0, y: 0, heading: 0 }; // faces east
    const target = { x: 3, y: 0, heading: 180 }; // faces west
    const pose = flushMatePose(drag, target);
    // the dragged endplate point lands exactly on the target point…
    const p = applyMatePose({ x: drag.x, y: drag.y }, pose);
    expect(p.x).toBeCloseTo(3);
    expect(p.y).toBeCloseTo(0);
    // …and its outward normal is opposite the target's.
    expect(((matedHeading(drag.heading, pose) % 360) + 360) % 360).toBeCloseTo(0);
    expect(((pose.rot % 360) + 360) % 360).toBeCloseTo(0);
  });

  it("swings a corner's free face fully around to clamp (90° start)", () => {
    // corner free face points NORTH (90°); neighbour's free face points WEST.
    const corner = { x: 0, y: 0, heading: 90 };
    const target = { x: 5, y: 2, heading: 180 };
    const pose = flushMatePose(corner, target);
    const p = applyMatePose({ x: corner.x, y: corner.y }, pose);
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(2);
    // outward normals end up opposite: corner → EAST (0°), target → WEST (180°).
    const h = ((matedHeading(corner.heading, pose) % 360) + 360) % 360;
    expect(h).toBeCloseTo(0);
  });

  it("carries the rest of the module rigidly (a second point rotates with it)", () => {
    // A straight module: endplate at origin facing north, other end 24″ north.
    const drag = { x: 0, y: 0, heading: 90 };
    const target = { x: 0, y: 0, heading: 0 }; // faces east → module must face west
    const pose = flushMatePose(drag, target);
    // The far end (0,24) is 24″ from the mated endplate; after mating the whole
    // body is rigid, so it stays 24″ from the target point.
    const far = applyMatePose({ x: 0, y: 24 }, pose);
    const d = Math.hypot(far.x - target.x, far.y - target.y);
    expect(d).toBeCloseTo(24);
  });
});
