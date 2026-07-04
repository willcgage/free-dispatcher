import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (#... full-flow). Boots the real app against a throwaway DB
 * (FD_DB_DIR) on its own port, then drives the browser through the whole chain:
 * build a layout → attach to a session → dispatch.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: "line",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Run the dev server: it's development mode (so /api/admin/token is issued
    // without SERVER_MODE, and no mDNS advertising is started) and turbopack
    // compiles routes on demand quickly. A throwaway DB keeps runs isolated.
    command: "npm run dev",
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      FD_DB_DIR: "./.data/e2e",
    },
  },
});
