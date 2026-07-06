import { describe, it, expect, vi, beforeEach } from "vitest";

// --- db mock -----------------------------------------------------------
// The sync service uses two distinct query patterns:
//   1. select().from().where() — for reading/writing app_settings
//   2. select({count:…}).from(table) — awaited directly (no .where)
//
// We make from() return a thenable that *also* has .where() so both
// patterns resolve correctly via mockResolvedValueOnce queuing.
const mockWhere = vi.fn();
const mockOnConflict = vi.fn();

// A factory that creates a from() return value: awaitable as `rows` AND
// exposes .where() pointing at our shared mockWhere.
function makeFromResult(directRows: unknown[]) {
  return {
    where: mockWhere,
    then(
      onfulfilled: (v: unknown) => unknown,
      onrejected?: (e: unknown) => unknown,
    ) {
      return Promise.resolve(directRows).then(onfulfilled, onrejected);
    },
    catch(onrejected: (e: unknown) => unknown) {
      return Promise.resolve(directRows).catch(onrejected);
    },
  };
}

const mockFrom = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(() => ({ from: mockFrom })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ onConflictDoUpdate: mockOnConflict })),
    })),
    // Tombstone pass (#155): update … set … where … returning
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
      })),
    })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    $count: vi.fn(() => ({ type: "sql_count_expression" })),
  },
}));

// --- auth mock ---------------------------------------------------------
// vi.mock factories are hoisted to the top of the file, so variables must
// also be hoisted via vi.hoisted() to be accessible inside the factory.
const { mockGetValidToken, mockClearAuth } = vi.hoisted(() => ({
  mockGetValidToken: vi.fn(),
  mockClearAuth: vi.fn(),
}));

vi.mock("../ModuleRepoAuth", () => ({
  getValidToken: mockGetValidToken,
  clearAuth: mockClearAuth,
  ReauthRequired: class ReauthRequired extends Error {
    constructor() {
      super("session expired");
      this.name = "ReauthRequired";
    }
  },
}));

vi.mock("@/lib/config", () => ({
  config: {
    moduleRepo: {
      url: "https://repo.example.com",
      anonKey: "anon-key",
    },
  },
}));

import { syncModules, getSyncMeta } from "../ModuleRepoSync";
import { ReauthRequired } from "../ModuleRepoAuth";

// --- helpers -----------------------------------------------------------
const makeModule = (n: number) => ({
  record_number: `MOD-${n}`,
  module_name: `Module ${n}`,
  description: null,
  category: "Straight",
  geometry_type: "straight",
  length_feet: 2,
  length_inches: 0,
  endplate_count: 2,
  has_mss: false,
  mss_type: null,
  status: "active",
  updated_at: "2026-01-01T00:00:00Z",
  endplates: null,
  tracks: null,
  industries: null,
});

const NO_SYNC_META: unknown[] = [];
const SYNC_META = [
  {
    key: "module_repo_sync",
    value: { last_synced_at: "2026-06-01T00:00:00Z", module_count: 5 },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetValidToken.mockResolvedValue("bearer-token");
  mockOnConflict.mockResolvedValue(undefined);
  mockClearAuth.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", vi.fn());

  // Default from() behavior:
  //   first call  → select-where for sync meta (no previous sync)
  //   second call → count query after upsert
  mockFrom
    .mockReturnValueOnce(makeFromResult(NO_SYNC_META)) // readSyncMeta
    .mockReturnValueOnce(makeFromResult([{ count: 2 }])); // count after upsert
  mockWhere.mockResolvedValue(NO_SYNC_META);
});

// -----------------------------------------------------------------------
describe("syncModules — happy path", () => {
  it("fetches the modules endpoint with a Bearer token", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([makeModule(1), makeModule(2)]), {
        status: 200,
      }),
    );

    await syncModules();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/functions/v1/modules-full"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer bearer-token",
        }),
      }),
    );
  });

  it("returns synced count and timestamp", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([makeModule(1), makeModule(2)]), {
        status: 200,
      }),
    );

    const result = await syncModules();

    expect(result).toMatchObject({ synced: 2 });
    expect((result as { lastSyncedAt: string }).lastSyncedAt).toBeTruthy();
  });

  it("upserts each module into repo_modules", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([makeModule(1), makeModule(2)]), {
        status: 200,
      }),
    );

    await syncModules();

    // One upsert per module
    expect(mockOnConflict).toHaveBeenCalledTimes(3); // 2 modules + 1 sync meta write
  });

  it("requests all statuses and reconciles against the full id list (#163)", async () => {
    // The reconcile adds a local-status select between the meta read and the
    // final count query — give the order-sensitive from() mock a third result.
    mockFrom.mockReturnValueOnce(makeFromResult([{ count: 2 }]));
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify([makeModule(1)]), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { record_number: "FMN-0001", status: "active" },
            { record_number: "FMN-0002", status: "inactive" },
          ]),
          { status: 200 },
        ),
      );

    await syncModules();

    // Main fetch mirrors every status (not just active)…
    const mainUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(mainUrl).toContain("status=any");
    // …and the tombstone diff uses a SECOND, complete id listing — never the
    // (possibly incremental) main fetch (the #156 mass-tombstone bug).
    const idsUrl = vi.mocked(fetch).mock.calls[1][0] as string;
    expect(idsUrl).toContain("fields=ids");
    expect(idsUrl).toContain("status=any");
  });

  it("skips the tombstone diff when the id listing fails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify([makeModule(1)]), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response("oops", { status: 500 }));

    const result = await syncModules();

    expect(result).toMatchObject({ synced: 1, removed: 0, restored: 0 });
  });

  it("appends updated_since param when a previous sync exists", async () => {
    // Override: first from() returns existing sync meta
    mockFrom.mockReset();
    mockFrom
      .mockReturnValueOnce(makeFromResult(SYNC_META))
      .mockReturnValueOnce(makeFromResult([{ count: 6 }]));
    mockWhere.mockResolvedValue(SYNC_META);

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([makeModule(1)]), { status: 200 }),
    );

    await syncModules();

    const url = (vi.mocked(fetch).mock.calls[0][0] as string);
    expect(url).toContain("updated_since=2026-06-01T00%3A00%3A00Z");
  });
});

// -----------------------------------------------------------------------
describe("syncModules — error handling", () => {
  it("returns session_expired when getValidToken throws ReauthRequired", async () => {
    mockGetValidToken.mockRejectedValueOnce(new ReauthRequired());

    const result = await syncModules();

    expect(result).toMatchObject({ error: "session_expired" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("clears auth and returns session_expired on 401 response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 401 }),
    );

    const result = await syncModules();

    expect(result).toMatchObject({ error: "session_expired" });
    expect(mockClearAuth).toHaveBeenCalled();
  });

  it("returns no_access on 403 without clearing auth", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 403 }),
    );

    const result = await syncModules();

    expect(result).toMatchObject({ error: "no_access" });
    expect(mockClearAuth).not.toHaveBeenCalled();
  });

  it("returns network_error when fetch throws", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await syncModules();

    expect(result).toMatchObject({ error: "network_error" });
    expect(mockOnConflict).not.toHaveBeenCalled(); // catalog untouched
  });

  it("returns api_error on unexpected non-ok status", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 500 }),
    );

    const result = await syncModules();

    expect(result).toMatchObject({ error: "api_error" });
  });

  it("names a 404 endpoint problem instead of a bare api_error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }));

    const result = await syncModules();

    expect(result).toMatchObject({ error: "api_error" });
    expect((result as { message: string }).message).toContain("404");
  });

  it("includes the upstream message in the error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "query_failed", message: "boom" }), {
        status: 500,
      }),
    );

    const result = await syncModules();

    expect((result as { message: string }).message).toContain("boom");
  });
});

// -----------------------------------------------------------------------
describe("getSyncMeta", () => {
  it("returns null when no sync has run", async () => {
    mockFrom.mockReset();
    mockFrom.mockReturnValueOnce(makeFromResult([]));
    mockWhere.mockResolvedValueOnce([]);

    const meta = await getSyncMeta();

    expect(meta).toBeNull();
  });

  it("returns existing sync meta", async () => {
    mockFrom.mockReset();
    mockFrom.mockReturnValueOnce(makeFromResult(SYNC_META));
    mockWhere.mockResolvedValueOnce(SYNC_META);

    const meta = await getSyncMeta();

    expect(meta).toMatchObject({
      last_synced_at: "2026-06-01T00:00:00Z",
      module_count: 5,
    });
  });
});
