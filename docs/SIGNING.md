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

## Windows — Azure Trusted Signing

The Package workflow's Windows job signs via **Azure Trusted Signing** when its
secrets are set (electron-builder `win.azureSignOptions`, injected as config
overrides). Without them it builds **unsigned** — SmartScreen "unknown
publisher" click-through. ~$9.99/month, no USB token, clears SmartScreen.

### One-time Azure setup
1. Create a **Trusted Signing account** (Azure portal → Trusted / Artifact
   Signing) and complete **identity validation** — Microsoft verifies the
   publisher; can take a few days.
2. Create a **certificate profile** in that account (note its name).
3. Create an **app registration** (Microsoft Entra) with a **client secret**,
   and assign it the **Trusted Signing Certificate Profile Signer** role on the
   account.
4. Note the account's **endpoint** (region URL, e.g. `https://eus.codesigning.azure.net/`).

### Repo secrets (Settings → Secrets and variables → Actions)
| Secret | Value |
| --- | --- |
| `AZURE_TENANT_ID` | Entra tenant id |
| `AZURE_CLIENT_ID` | app registration (client) id |
| `AZURE_CLIENT_SECRET` | the client secret |
| `AZURE_TS_ENDPOINT` | Trusted Signing endpoint URL |
| `AZURE_TS_ACCOUNT` | Trusted Signing account name |
| `AZURE_TS_PROFILE` | certificate profile name |
| `AZURE_TS_PUBLISHER` | publisher/subject name on the cert profile (your validated identity name) — required by electron-builder's schema |

Then run the Package workflow (`v*` tag or **Actions → Package installers → Run
workflow**) — the Windows job produces a signed `.exe`.

> Alternatives if you reconsider: a **Certum** open-source cert (~$50). Plain
> `.pfx` files are no longer issued — the private key must live on an HSM/token.
>
> **SignPath Foundation** (free for open source) was applied for and **rejected**
> (2026-07), so it's not an option here. Azure Trusted Signing was attempted
> first and abandoned when identity validation repeatedly failed — the setup
> above is kept only in case that's revisited.

---

## Notes
- Build each OS's installer **on that OS** (or a matching CI runner). macOS
  notarization in particular must run on macOS.
- Keep the `.p8`, `.p12`, and passwords out of the repo (they're gitignored via
  `*.pem` / `.env*`, but store them in a secret manager or your OS keychain).
