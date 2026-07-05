import { describe, it, expect } from "vitest";
import { moduleUnavailability } from "../moduleAvailability";

describe("moduleUnavailability (#158)", () => {
  it("tombstone wins over status", () => {
    expect(
      moduleUnavailability({ removedFromRepoAt: "2026-07-05", status: "active" }),
    ).toBe("removed");
  });

  it("owner status drives availability, case-insensitively", () => {
    expect(moduleUnavailability({ status: "inactive" })).toBe("inactive");
    expect(moduleUnavailability({ status: "Archived" })).toBe("archived");
    expect(moduleUnavailability({ status: " INACTIVE " })).toBe("inactive");
  });

  it("active or unknown status is available", () => {
    expect(moduleUnavailability({ status: "active" })).toBeNull();
    expect(moduleUnavailability({ status: null })).toBeNull();
    expect(moduleUnavailability({})).toBeNull();
    expect(moduleUnavailability({ status: "something-new" })).toBeNull();
  });
});
