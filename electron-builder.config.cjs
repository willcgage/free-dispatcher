/**
 * electron-builder configuration (#32). A JS config (not package.json `build`)
 * so Windows Azure Trusted Signing can be added conditionally as a real object
 * from env vars — injecting it via CLI `-c.*` overrides produced a malformed
 * value that failed schema validation (#36).
 *
 * Signing is env-driven and optional:
 *  - macOS: signed + notarized when CSC_LINK + APPLE_API_* are set (the CI
 *    "Prepare macOS signing" step); unsigned otherwise.
 *  - Windows: Azure Trusted Signing when AZURE_TS_* + AZURE_CLIENT_ID are set;
 *    unsigned otherwise.
 */
const config = {
  appId: "org.freedispatcher.host",
  productName: "Free Dispatcher",
  artifactName: "${name}-${version}-${arch}.${ext}",
  // Auto-update feed (electron-updater). Public repo, so clients download
  // updates with no token. CI builds with `--publish never`, which still emits
  // the updater metadata (latest.yml / *.blockmap) into dist/; the release job
  // attaches those to the GitHub Release for the updater to read.
  publish: [{ provider: "github", owner: "willcgage", repo: "free-dispatcher" }],
  directories: { output: "dist", buildResources: "build" },
  files: ["electron/**/*", "package.json"],
  extraResources: [
    { from: ".next/standalone", to: "standalone" },
    { from: ".next/standalone/node_modules", to: "standalone/node_modules" },
  ],
  win: { target: ["nsis"], icon: "build/icon.ico" },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true, perMachine: false },
  mac: {
    target: ["dmg"],
    icon: "build/icon.icns",
    category: "public.app-category.utilities",
    hardenedRuntime: true,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.plist",
    notarize: true,
  },
  linux: { target: ["AppImage", "deb"], category: "Utility", icon: "build/icon.png" },
};

// Windows Azure Trusted Signing — only when the account env vars are present
// (the CI "Prepare Windows signing" step sets them from secrets). Auth is the
// AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET service principal.
if (process.env.AZURE_TS_ENDPOINT && process.env.AZURE_CLIENT_ID && process.env.AZURE_TS_PUBLISHER) {
  config.win.azureSignOptions = {
    endpoint: process.env.AZURE_TS_ENDPOINT,
    codeSigningAccountName: process.env.AZURE_TS_ACCOUNT,
    certificateProfileName: process.env.AZURE_TS_PROFILE,
    // Required by electron-builder's schema; must match the publisher/subject
    // name on your Trusted Signing certificate profile.
    publisherName: process.env.AZURE_TS_PUBLISHER,
  };
}

module.exports = config;
