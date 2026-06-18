# Code signing the desktop host

The installers built by `npm run dist` (#32) are signed so operators don't get
"unknown developer" / "unidentified developer" blocks.

| Platform | Status | Result without it |
| --- | --- | --- |
| **macOS** | Signed + **notarized** (your Apple Developer account) | Gatekeeper blocks "unidentified developer" |
| **Windows** | **Unsigned for now** (deferred) | SmartScreen "unknown publisher" warning (click-through) |
| **Linux** | n/a (AppImage/deb unsigned) | none |

Signing happens during `npm run dist` on each target OS — **not** in the
lint/types/build CI, which never packages.

---

## macOS — Developer ID signing + notarization

Two independent pieces: a **certificate** signs the app; **notarization** has
Apple scan it. You need both. Build on a Mac.

### 1. Developer ID Application certificate (one-time)
1. Xcode → Settings → Accounts → your Apple ID → **Manage Certificates** → **+**
   → **Developer ID Application**. (Or create it at
   <https://developer.apple.com/account/resources/certificates>.)
2. It installs into your **login Keychain**. That's all electron-builder needs
   for a local build — it auto-discovers the identity.
   - *For CI / another machine:* export it as a `.p12` (Keychain Access → right-
     click the cert → Export), then set `CSC_LINK` (base64 of the `.p12`, or a
     file path) and `CSC_KEY_PASSWORD`.

### 2. App Store Connect API key for notarization (one-time)
1. <https://appstoreconnect.apple.com> → **Users and Access** → **Integrations**
   → **App Store Connect API** → **+** to create a key (role: **Developer**).
2. **Download the `.p8` immediately** — Apple only lets you download it once.
3. Note the **Key ID** and the **Issuer ID** (shown on that page).

### 3. Set the environment, then build
```bash
export APPLE_API_KEY="/secure/path/AuthKey_XXXXXXXXXX.p8"
export APPLE_API_KEY_ID="XXXXXXXXXX"        # the Key ID
export APPLE_API_ISSUER="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # the Issuer ID

npm run dist                                 # → dist/Free Dispatcher-*.dmg
```
electron-builder signs with the Developer ID identity from your Keychain and
notarizes via the API key (config: `mac.notarize: true` + hardened runtime +
`build/entitlements.mac.plist`, already set in `package.json`).

> If notarization seems skipped with the API key, set all three env vars in the
> same shell as `npm run dist`, and (fallback) add your team id:
> `"mac": { "notarize": { "teamId": "<YOUR_TEAM_ID>" } }`.

### 4. Verify
```bash
codesign --verify --deep --strict --verbose=2 "dist/mac/Free Dispatcher.app"
spctl -a -vvv -t install "dist/mac/Free Dispatcher.app"   # → "accepted, source=Notarized Developer ID"
```

---

## Sign in CI (GitHub Actions — no Mac required)

The Package workflow (`.github/workflows/package.yml`) signs + notarizes the
macOS build automatically **when these repo secrets are set** (Settings →
Secrets and variables → Actions). With the secrets absent it builds unsigned, so
forks and pre-setup builds still work.

| Secret | Value |
| --- | --- |
| `CSC_LINK` | base64 of your **Developer ID Application** `.p12` |
| `CSC_KEY_PASSWORD` | the `.p12` export password |
| `APPLE_API_KEY_B64` | base64 of your App Store Connect `.p8` |
| `APPLE_API_KEY_ID` | the API **Key ID** |
| `APPLE_API_ISSUER` | the **Issuer ID** |

Base64-encode the two files on any machine:

```bash
# macOS / Linux
base64 -i AuthKey_XXXXXXXXXX.p8        # → APPLE_API_KEY_B64
base64 -i DeveloperID_Application.p12  # → CSC_LINK
```
```powershell
# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXXXXXXXX.p8"))
[Convert]::ToBase64String([IO.File]::ReadAllBytes("DeveloperID_Application.p12"))
```

Then run the Package workflow (push a `v*` tag or **Actions → Package installers
→ Run workflow**) — the macOS runner produces a **signed + notarized** `.dmg`,
no Mac of your own needed. Getting the `.p12` without a Mac: see step 1
(`openssl` CSR → Apple portal → `.cer` → `.p12`).

> ⚠️ Revoke the `.p8` that was shared in chat earlier and create a fresh App
> Store Connect API key for `APPLE_API_KEY_B64`.

---

## Windows — unsigned (for now)

`npm run dist` on Windows produces an unsigned NSIS installer. On first run users
see **SmartScreen → "Windows protected your PC"**; they click **More info → Run
anyway**. Functional, just not friction-free.

**When you're ready to sign**, the cheapest modern path is **Azure Trusted
Signing** (~$10/mo, cloud, no USB token, clears SmartScreen; US/Canada
individuals/orgs). electron-builder supports it natively via `win.azureSignOptions`
— set up a Trusted Signing account + app registration, then add that block and
the auth env vars. (Alternatives: SSL.com eSigner / DigiCert KeyLocker cloud
certs, or a hardware-token OV/EV cert.) Plain `.pfx` files are no longer issued —
since 2023 the private key must live on an HSM or hardware token.

---

## Notes
- Build each OS's installer **on that OS** (or a matching CI runner). macOS
  notarization in particular must run on macOS.
- Keep the `.p8`, `.p12`, and passwords out of the repo (they're gitignored via
  `*.pem` / `.env*`, but store them in a secret manager or your OS keychain).
