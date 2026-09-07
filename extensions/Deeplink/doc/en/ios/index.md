# Cocos Deeplink — iOS Requirements (English)

This page covers everything iOS-specific: what the extension injects
automatically, and — the part most people get wrong — how to correctly set
up **iOS Universal Links** so `https://` links open your app instead of (or
in addition to) Safari.

## What the extension does for you

On every iOS build, when `enableDeeplink` is on, the extension:

1. Copies `Pre-deeplink.cmake` / `Post-deeplink.cmake` into
   `native/engine/ios/`, and the `deeplink/` bridge sources (pure Objective-C,
   ARC, no Swift runtime, no `.xcframework`) into the built Xcode project as
   `proj/deeplink`. `deeplink.cmake` builds them as a static library and
   links it into the app target with `-ObjC`.
2. Injects a `CFBundleURLTypes` entry into `native/engine/ios/Info.plist`
   for the `urlScheme` option (idempotent — checks whether the scheme is
   already registered before appending).
3. Injects `com.apple.developer.associated-domains` entries into the
   project's `.entitlements` file for the `associatedDomains` option
   (idempotent, same de-dup logic).
4. `native/engine/ios/AppDelegate.mm` already contains the wiring for
   `DeeplinkServiceHub` (`initDeeplinkService` / `handleLaunchOptions:` in
   `didFinishLaunchingWithOptions:`, `handleOpenURL:` in
   `application:openURL:options:`, and `handleUserActivity:` in
   `application:continueUserActivity:restorationHandler:`), guarded by
   `#if __has_include("DeeplinkServiceHub.h")` — **no manual AppDelegate
   edits are needed**, it activates automatically once the library is
   copied in by step 1.

Custom URL schemes (`urlScheme`) work immediately after a rebuild — no
server-side setup required. Universal Links (`associatedDomains`) need the
extra server-side step below.

## Permissions / Capabilities

- **Associated Domains** capability must be enabled for the app's App ID in
  your Apple Developer account and in the Xcode project's *Signing &
  Capabilities* tab. The extension injects the domains into the
  `.entitlements` **file**, but the capability must also be turned on for
  the target/App ID — Xcode normally does this automatically the first time
  you add an Associated Domains entry through its UI; if you only ever build
  via CI/CLI, verify the App ID has the capability enabled in the [Apple
  Developer portal](https://developer.apple.com/account/resources/identifiers/list).
- No other special entitlement or `Info.plist` permission key is required
  for custom URL schemes.

## Setting up iOS Universal Links (the part people get wrong)

### 1. Configure the build panel

On the **iOS** tab of the build panel, set `associatedDomains` to a
comma-separated list, e.g.:

```
applinks:example.com
```

(Add more domains, or `webcredentials:` / `activitycontinuation:` prefixes
for other Associated Domains use cases, comma-separated in the same field —
this extension only manages entries under
`com.apple.developer.associated-domains`.)

### 2. Host the Apple App Site Association (AASA) file

Create and host this file at **both** of these paths (Apple checks the
well-known path first, falling back to the root for older devices — host it
at the well-known path; hosting at both is safest):

```
https://example.com/.well-known/apple-app-site-association
https://example.com/apple-app-site-association
```

Content (format for iOS 13+; note there is **no `.json` extension** on the
file):

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["TEAMID1234.com.yourcompany.yourapp"],
        "components": [
          { "/": "/product/*", "comment": "Matches any /product/* URL" },
          { "/": "/share/*", "comment": "Matches any /share/* URL" }
        ]
      }
    ]
  }
}
```

- `TEAMID1234` is your **Apple Developer Team ID** (10 characters, found in
  the Apple Developer portal → *Membership*), and
  `com.yourcompany.yourapp` is your app's bundle identifier — together they
  form the `appID` Apple expects.
- `components` lets you scope which paths open the app vs. Safari; omit it
  (or use `{ "/": "*" }`) to match every path under the domain.
- Older/simpler apps may see a flat `"paths": ["/product/*", "/share/*"]`
  format instead of `components` — both are accepted, prefer `components`
  for new setups (it also supports query/fragment matching).

Hosting requirements (iOS checks every one of these, at **install time**,
and caches the result — see the troubleshooting note below):

- Served over **HTTPS**, valid certificate (no self-signed / expired certs).
- **No redirects at all** — not HTTP→HTTPS, not a `www.` redirect, nothing.
  Host the file directly at the final HTTPS URL.
- **No file extension** (`apple-app-site-association`, not `.json`).
- `Content-Type` should be `application/json` (some CDNs need an explicit
  MIME type override since the file has no extension to infer from).
- File size limit: **128 KB**.
- Publicly reachable without authentication.

Quick check before you rely on it:

```bash
curl -sI https://example.com/.well-known/apple-app-site-association
curl -s  https://example.com/.well-known/apple-app-site-association | python3 -m json.tool
```

Apple also provides a validator in Xcode: *Signing & Capabilities* → domain
row → the small AASA status indicator, or use a third-party checker such as
https://branch.io/resources/aasa-validator/.

### 3. Enable the Associated Domains capability in Xcode

If you build through Xcode directly (not just via the Cocos build
pipeline):

1. Select your app target → **Signing & Capabilities**.
2. Click **+ Capability** → **Associated Domains** (skip if already present
   — the extension's entitlements injection only edits the file, this step
   registers the capability with your App ID).
3. Add an entry `applinks:example.com` (this is normally already present
   after the extension's injection runs — verify it matches).

### 4. Rebuild, reinstall, and test

iOS fetches and caches the AASA file **at install time** (and periodically
thereafter) — it does **not** re-fetch on every launch. If you change the
AASA file on your server, you must **uninstall and reinstall** the app (or
wait for iOS's periodic re-fetch) to see the update take effect during
testing.

To test:

```bash
xcrun simctl openurl booted "https://example.com/product/42"
```

or on a real device, send yourself the link (e.g. via Messages/Notes) and
tap it — long-pressing the link and choosing "Open in \<Your App\>" also
confirms the association even if tapping opens Safari (which can happen if
the domain isn't in the user's "Open in Safari instead" per-app override,
Settings → \<Your App\> → *Associated Domains* / *Open Links*, which the
user must not have set to "In Safari").

Once handled, read the parsed URL the same way for both custom schemes and
Universal Links:

```ts
import { deeplink } from 'db://deeplink/index';

deeplink.onDeeplinkReceived((url) => {
    console.log('scheme:', url.scheme, 'path:', url.path);
});
await deeplink.initialize();
```

### Common verification failures

| Symptom | Likely cause |
| --- | --- |
| Link always opens Safari | AASA unreachable, wrong content type, has a redirect, or wasn't re-fetched since you last edited it (reinstall the app) |
| Works in Simulator, not on device | Simulator doesn't always enforce AASA caching the same way; test on a real device before shipping |
| Long-press "Open in App" works but a plain tap doesn't | User has a per-app "Open in Safari" preference set — check Settings → \<Your App\> |
| `appIDs` "valid" in Xcode but link still fails | Team ID or bundle ID typo in the AASA `appIDs` string — must be exact, case-sensitive |

## Build Configuration

- Minimum iOS deployment target: **iOS 13.0** (matches the Cocos project
  floor; set in `deeplink.cmake`).
- No third-party dependencies, no Swift runtime, no `.xcframework` — the
  bridge is pure Objective-C linked as a static library via CMake.
- Frameworks linked: `Foundation`, `UIKit` (both already linked by the
  Cocos engine target; declared explicitly here as a defensive measure).

## Known Limitations

- `isDomainAssociated()` is **not available on iOS** — it always rejects
  with `E_NOT_SUPPORTED`. There is no public iOS API to query Universal
  Link verification state at runtime; use the AASA validator tools above
  during development instead.
- `navigateToOpenByDefaultSettings()` is Android-only and rejects with
  `E_NOT_SUPPORTED` on iOS — direct users to **Settings → \<Your App\>**
  manually if they've disabled Universal Links for your app.
- Disabling `enableDeeplink` does not retroactively strip previously
  injected `CFBundleURLTypes` / Associated Domains entries from a project
  that was already built with it enabled — clean-build the native project
  for a fully clean slate.
