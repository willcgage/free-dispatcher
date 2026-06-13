import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the host can be
  // packaged (Electron) without a full node_modules / npm install. See #32.
  output: "standalone",

  // PGlite ships a WASM Postgres; bundling it breaks its wasm loader
  // ("instantiateWasm is not a function" in the standalone build). Keep it
  // external so it's required from node_modules and traced into standalone.
  serverExternalPackages: ["@electric-sql/pglite"],

  // The Drizzle migration files are read at runtime by the boot-time migrator
  // (instrumentation.ts → lib/db/runMigrations). They aren't a traced import,
  // so include them explicitly in the standalone output.
  outputFileTracingIncludes: {
    "/**": ["./lib/db/migrations/**/*"],
  },
};

export default nextConfig;
