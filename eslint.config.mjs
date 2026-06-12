import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Archived v0.7 Electron/FastAPI app — not part of the v2 lint scope.
    "legacy/**",
    // Standalone CommonJS Node process, linted separately if at all.
    "token-server/**",
  ]),
]);

export default eslintConfig;
