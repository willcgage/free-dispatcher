import { describe, it, expect, vi, beforeEach } from "vitest";

// Mutable mock of the WiThrottle service the JMRI adapter delegates to.
// vi.hoisted so it exists before the hoisted vi.mock factory runs.
const wt = vi.hoisted(() => ({
  connected: false,
  enabled: false,
  target: null as { host: string; port: number } | null,
  powerOff: vi.fn((): boolean => true),
  powerOn: vi.fn((): boolean => true),
}));
vi.mock("@/lib/withrottle/WiThrottleService", () => ({
  wiThrottleService: wt,
}));

import { NullAdapter } from "../NullAdapter";
import { JmriAdapter } from "../JmriAdapter";

beforeEach(() => {
  vi.clearAllMocks();
  wt.connected = false;
  wt.enabled = false;
  wt.target = null;
  wt.powerOff.mockReturnValue(true);
  wt.powerOn.mockReturnValue(true);
});

describe("NullAdapter", () => {
  const a = new NullAdapter();

  it("advertises no physical capabilities", () => {
    expect(a.capabilities).toEqual({ emergencyStop: false, emergencyOff: false });
    expect(a.status().connected).toBe(false);
  });

  it("reports nothing physical happened", () => {
    expect(a.emergencyStop().applied).toBe(false);
    expect(a.emergencyOff().applied).toBe(false);
    expect(a.powerOn().applied).toBe(false);
  });
});

describe("JmriAdapter", () => {
  const a = new JmriAdapter();

  it("supports power-off but not keep-power stop", () => {
    expect(a.capabilities).toEqual({ emergencyStop: false, emergencyOff: true });
  });

  it("status reflects live connection + target", () => {
    wt.connected = true;
    wt.target = { host: "10.0.0.5", port: 12090 };
    const s = a.status();
    expect(s.connected).toBe(true);
    expect(s.target).toBe("10.0.0.5:12090");
  });

  it("emergencyOff sends PPA0 when connected", () => {
    wt.connected = true;
    const r = a.emergencyOff();
    expect(wt.powerOff).toHaveBeenCalledOnce();
    expect(r).toEqual({ applied: true, detail: expect.stringContaining("PPA0") });
  });

  it("emergencyOff is a no-op (not applied) when disconnected", () => {
    wt.connected = false;
    const r = a.emergencyOff();
    expect(wt.powerOff).not.toHaveBeenCalled();
    expect(r.applied).toBe(false);
  });

  it("emergencyOff reports failure when the send fails", () => {
    wt.connected = true;
    wt.powerOff.mockReturnValue(false);
    expect(a.emergencyOff().applied).toBe(false);
  });

  it("emergencyStop is unsupported on WiThrottle", () => {
    wt.connected = true;
    const r = a.emergencyStop();
    expect(r.applied).toBe(false);
    expect(wt.powerOff).not.toHaveBeenCalled();
  });

  it("powerOn sends PPA1 when connected", () => {
    wt.connected = true;
    const r = a.powerOn();
    expect(wt.powerOn).toHaveBeenCalledOnce();
    expect(r).toEqual({ applied: true, detail: expect.stringContaining("PPA1") });
  });
});
