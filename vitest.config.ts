import { defineConfig, configDefaults } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    // e2e/ holds Playwright specs — they run via `npm run e2e`, not vitest.
    exclude: [...configDefaults.exclude, "e2e/**"],
    coverage: { provider: "v8", reporter: ["text", "lcov"] },
  },
});
