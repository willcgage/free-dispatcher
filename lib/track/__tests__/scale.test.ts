import { describe, it, expect } from "vitest";
import {
  inchesToScaleFeet,
  scaleFeetToInches,
  N_SCALE_RATIO,
} from "../scale";

describe("N-scale conversions", () => {
  it("is 1:160", () => {
    expect(N_SCALE_RATIO).toBe(160);
  });

  it("turns 396 real inches into one scale mile (5280 ft)", () => {
    expect(inchesToScaleFeet(396)).toBeCloseTo(5280);
  });

  it("converts a 24in siding to 320 scale feet", () => {
    expect(inchesToScaleFeet(24)).toBeCloseTo(320);
  });

  it("round-trips inches ↔ scale feet", () => {
    expect(scaleFeetToInches(inchesToScaleFeet(30))).toBeCloseTo(30);
    expect(inchesToScaleFeet(scaleFeetToInches(1000))).toBeCloseTo(1000);
  });
});
