/**
 * Finalize the Next.js standalone output for packaging (#32).
 *
 * `next build` with `output: 'standalone'` emits `.next/standalone/server.js`
 * plus a trimmed node_modules, but it does NOT copy the static assets — by
 * design it leaves that to the deployer. Without them the host serves a UI with
 * no CSS/JS and no /public files. This copies:
 *   .next/static  -> .next/standalone/.next/static   (hashed client assets)
 *   public        -> .next/standalone/public         (favicon, icons, etc.)
 *
 * Run after `next build`; the Electron build (and a manual `start:standalone`)
 * depend on it.
 */
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

if (!existsSync(join(standalone, "server.js"))) {
  console.error(
    "✗ .next/standalone/server.js not found — run `next build` first.",
  );
  process.exit(1);
}

const copies = [
  [join(root, ".next", "static"), join(standalone, ".next", "static")],
  [join(root, "public"), join(standalone, "public")],
  // Ship the changelog so the in-app Release Notes page works offline; the
  // server reads it from its cwd (the standalone dir) at runtime.
  [join(root, "CHANGELOG.md"), join(standalone, "CHANGELOG.md")],
];

for (const [from, to] of copies) {
  if (existsSync(from)) {
    cpSync(from, to, { recursive: true });
    console.log(`✓ copied ${from.replace(root, ".")} -> ${to.replace(root, ".")}`);
  } else {
    console.log(`· skipped (missing) ${from.replace(root, ".")}`);
  }
}

console.log("✓ standalone output ready to serve the full UI");
