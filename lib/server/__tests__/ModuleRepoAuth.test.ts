import { describe, it, expect, vi, beforeEach } from "vitest";

// --- db mock -----------------------------------------------------------
// Minimal in-memory stand-in. `where` is exposed so each test can configure
// what rows to return; `onConflict` and `deleteWhere` are exposed for
// call-count assertions.
const mockWhere = vi.fn();
const mockOnConflict = vi.fn();
const mockDeleteWhere = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: mockWhere })) })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ onConflictDoUpdate: mockOnConflict })),
    })),
    delete: vi.fn(() => ({ where: mockDeleteWhere })),
    $count: vi.fn(),
  },
}));

vi.mock("@/lib/config", () => ({
  config: {
    moduleRepo: {
      url: "https://repo.example.com",
      anonKey: "test-anon-key",
    },
  },
}));

// Import after mocks are established
import {
  signIn,
  signOut,
  getValidToken,
  getAuthStatus,
  ReauthRequired,
} from "../ModuleRepoAuth";

// --- helpers -----------------------------------------------------------
const FUTURE = new Date(Date.now() + 3600_000).toISOString();
const PAST = new Date(Date.now() - 1000).toISOString();

const makeAuthRow = (overrides = {}) => ({
  key: "module_repo_auth",
  value: {
    email: "operator@example.com",
    access_token: "access-tok",
    refresh_token: "refresh-tok",
    expires_at: FUTURE,
    ...overrides,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  mockWhere.mockResolvedValue([]);
  mockOnConflict.mockResolvedValue(undefined);
  mockDeleteWhere.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", vi.fn());
});

// -----------------------------------------------------------------------
describe("signIn", () => {
  it("calls the Supabase password endpoint with email and anon key header", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "at",
          refresh_token: "rt",
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    );

    await signIn("user@example.com", "secret");

    expect(fetch).toHaveBeenCalledWith(
      "https://repo.example.com/auth/v1/token?grant_type=password",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "test-anon-key",
        }),
        body: JSON.stringify({ email: "user@example.com", password: "secret" }),
      }),
    );
  });

  it("stores tokens after successful sign-in", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "at",
          refresh_token: "rt",
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    );

    await signIn("user@example.com", "secret");

    expect(mockOnConflict).toHaveBeenCalled();
  });

  it("throws with server message on failed sign-in", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ error_description: "Invalid credentials" }),
        { status: 400 },
      ),
    );

    await expect(signIn("user@example.com", "wrong")).rejects.toThrow(
      "Invalid credentials",
    );
  });

  it("throws generic message when error body lacks description", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 500 }),
    );

    await expect(signIn("u@e.com", "p")).rejects.toThrow("Sign-in failed (500)");
  });
});

// -----------------------------------------------------------------------
describe("getValidToken", () => {
  it("returns access token when not expired", async () => {
    mockWhere.mockResolvedValueOnce([makeAuthRow()]);

    const token = await getValidToken();

    expect(token).toBe("access-tok");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws ReauthRequired when no auth is stored", async () => {
    mockWhere.mockResolvedValueOnce([]);

    await expect(getValidToken()).rejects.toBeInstanceOf(ReauthRequired);
  });

  it("calls the refresh endpoint when access token is expired", async () => {
    mockWhere.mockResolvedValueOnce([makeAuthRow({ expires_at: PAST })]);
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "new-at",
          refresh_token: "new-rt",
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    );

    const token = await getValidToken();

    expect(fetch).toHaveBeenCalledWith(
      "https://repo.example.com/auth/v1/token?grant_type=refresh_token",
      expect.objectContaining({ method: "POST" }),
    );
    expect(token).toBe("new-at");
  });

  it("throws ReauthRequired and sets expired flag when refresh fails", async () => {
    mockWhere.mockResolvedValueOnce([makeAuthRow({ expires_at: PAST })]);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
    );

    await expect(getValidToken()).rejects.toBeInstanceOf(ReauthRequired);
    // expired flag written + auth deleted
    expect(mockOnConflict).toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------
describe("signOut", () => {
  it("deletes auth and clears expired flag", async () => {
    await signOut();

    expect(mockDeleteWhere).toHaveBeenCalledTimes(2); // auth + expired flag
  });
});

// -----------------------------------------------------------------------
describe("getAuthStatus", () => {
  it("returns authenticated=true with email when signed in", async () => {
    // getAuthStatus calls where twice in Promise.all — order matches array order
    mockWhere
      .mockResolvedValueOnce([makeAuthRow()])
      .mockResolvedValueOnce([]); // no expired flag

    const status = await getAuthStatus();

    expect(status.authenticated).toBe(true);
    expect(status.email).toBe("operator@example.com");
    expect(status.sessionExpired).toBe(false);
  });

  it("returns authenticated=false with sessionExpired=true when flag is set", async () => {
    mockWhere
      .mockResolvedValueOnce([]) // no auth row
      .mockResolvedValueOnce([{ key: "module_repo_session_expired", value: true }]);

    const status = await getAuthStatus();

    expect(status.authenticated).toBe(false);
    expect(status.sessionExpired).toBe(true);
  });

  it("returns authenticated=false and sessionExpired=false when pristine", async () => {
    mockWhere.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const status = await getAuthStatus();

    expect(status.authenticated).toBe(false);
    expect(status.sessionExpired).toBe(false);
  });
});
