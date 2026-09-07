# Cocos Deeplink (English)

A Cocos Creator 3.8.x build-plugin extension that injects Android App Links
(`intent-filter` with `autoVerify`) and iOS Universal Links / custom URL
schemes (`CFBundleURLTypes`, Associated Domains) into the built native
project, plus a small async TypeScript runtime API for receiving deep-link
URLs — both the link that launched the app (cold start) and any link
delivered while the app is already running (warm start).

## Compatibility

| Cocos Creator | Android | iOS | Web / Editor preview |
| --- | --- | --- | --- |
| >= 3.8.0 | Android 5.0+ (API 21+); `autoVerify` domain checks need API 31+ | iOS 13.0+ | Not supported — every API call rejects with `E_NOT_SUPPORTED` |

## Installation

1. Copy `extensions/Deeplink` into your project's `extensions/` folder.
2. From a terminal, build the extension once:
   ```bash
   cd extensions/Deeplink
   npm install
   npm run build
   ```
   (Not required if you already have the committed `dist/` — this repo ships
   a pre-built `dist/`, so step 2 is only needed after you edit `source/`.)
3. Restart Cocos Creator, or use **Extension → Extension Manager** to enable
   the extension (look for **Deeplink**).
4. Open **Project → Build**, select the **Android** or **iOS** platform tab,
   and configure the Deeplink options described below (or leave the
   defaults for a quick "https" App Link setup).
5. Import the runtime API from the extension's asset-db mount:
   ```ts
   import { deeplink } from 'db://deeplink/index';
   ```

## Build Panel Options

The build panel has independent option sets for the Android and iOS tabs;
both share `enableDeeplink` / `overwriteLibrary`.

### Shared

| Option | Default | Description |
| --- | --- | --- |
| **Enable Deeplink** (`enableDeeplink`) | `true` | Master switch. When off, the native library copy and every manifest/plist/entitlements injection is skipped for that platform's build. |
| **Force overwrite the Deeplink library** (`overwriteLibrary`) | `true` | Overwrite the native library files in the built project from the extension template on every build. Turn off to preserve manual edits you made directly in the built project (not recommended for CI). |

### Android tab

| Option | Default | Description |
| --- | --- | --- |
| **URI Scheme** (`scheme`) | `https` | The `android:scheme` for the generated `intent-filter`. Use `https` for real App Links, or a custom scheme (e.g. `myapp`) for a scheme-only deep link. Leave empty to skip `intent-filter` injection entirely. |
| **Host** (`host`) | empty | The `android:host` (e.g. `example.com`). **Required** when scheme is `http`/`https` — App Links do not work without a host, and the build logs a warning if you leave it empty with an http(s) scheme. |
| **Path Prefix** (`pathPrefix`) | empty | Optional `android:pathPrefix` (e.g. `/app`). Omitted from the manifest when empty. |
| **Auto Verify** (`autoVerify`) | `true` | Sets `android:autoVerify="true"` on the `intent-filter`, which tells Android to perform Digital Asset Links verification against `assetlinks.json` on your domain (see [Android requirements](./android/index.md)). |
| **Intent Filter Label** (`label`) | empty | Optional `android:label` on the `intent-filter` element. Omitted when empty. |

### iOS tab

| Option | Default | Description |
| --- | --- | --- |
| **URL Scheme** (`urlScheme`) | empty | Custom URL scheme registered as a `CFBundleURLTypes` entry in `Info.plist` (e.g. `myapp`). Leave empty to skip. Idempotent — re-running the build does not duplicate the entry. |
| **Associated Domains** (`associatedDomains`) | empty | Comma-separated list added to `com.apple.developer.associated-domains` in the project's `.entitlements` file (e.g. `applinks:example.com`). Leave empty to skip. This is the iOS half of Universal Links — see [iOS requirements](./ios/index.md) for the full setup including the `apple-app-site-association` file. |

## API Reference

Import everything from the extension's asset-db barrel:

```ts
import { deeplink, DeeplinkClient } from 'db://deeplink/index';
import type { DeeplinkUrl, DeeplinkError } from 'db://deeplink/index';
```

`deeplink` is a ready-to-use singleton `DeeplinkClient`. All methods are
async and reject with a `DeeplinkError` (`{ code, message }`) on failure.

### `deeplink.initialize(): Promise<void>`

Initialise the deep-link system. Must be called once at app startup.
**Register `onDeeplinkReceived` handlers BEFORE calling this method** — the
native side buffers the cold-start URL (the link that launched the app,
if any) and delivers it as a `deeplinkReceived` event synchronously during
this call. Handlers registered after `initialize()` resolves will miss the
cold-start delivery.

### `deeplink.getLink(): Promise<DeeplinkUrl>`

Return the current (most recently received) deep-link URL. When no link has
been received, every string field of `DeeplinkUrl` is `""`. Check
`url.url !== ''` to know whether a link is present.

### `deeplink.clearData(): Promise<void>`

Clear the stored deep-link data on both platforms, so a subsequent
`getLink()` returns an empty `DeeplinkUrl` until a new link arrives. Call
this after you've handled the current link, to avoid re-processing it on
the next cold start.

### `deeplink.isDomainAssociated(domain: string): Promise<boolean>`

**Android 12+ (API 31+) only.** Checks whether `domain` has been verified as
an Android App Link for this app (the OS performs this check against
`assetlinks.json` on your domain). Rejects with `E_NOT_SUPPORTED` on iOS and
on Android below API 31.

### `deeplink.navigateToOpenByDefaultSettings(): Promise<void>`

**Android only.** Opens the system "Open by default" settings screen for
this app, where the user can change which link domains open the app. The
promise resolves when the user returns to the app (no internal timeout,
since the user may take an arbitrary amount of time). Rejects with
`E_NOT_SUPPORTED` on iOS.

### `deeplink.onDeeplinkReceived(handler: (url: DeeplinkUrl) => void): void`

Subscribe to every deep-link delivery — both the cold-start link (fired once,
during `initialize()`) and any warm-start link (fired any time afterwards,
whenever the OS delivers a new URL to the running app).

### `deeplink.offDeeplinkReceived(handler): void`

Unsubscribe a handler previously passed to `onDeeplinkReceived`.

### `DeeplinkUrl`

```ts
interface DeeplinkUrl {
    url: string;              // full URL, "" when absent
    scheme: string;            // e.g. "myapp", "https"
    host: string;               // e.g. "example.com"
    port?: number;
    path: string;                // e.g. "/items/42"
    pathExtension?: string;
    pathComponents?: string[];
    query?: string;               // without leading "?"
    fragment?: string;             // without leading "#"
    user?: string;
    password?: string;
}
```

### `DeeplinkError`

```ts
interface DeeplinkError {
    code: string;     // e.g. "E_NOT_SUPPORTED", "E_TIMEOUT"
    message: string;
}
```

Built-in codes: `E_NOT_SUPPORTED` (called on web/editor, or a
platform-exclusive method called on the wrong platform), `E_TIMEOUT` (no
native response within the call's timeout window). Any other code is
platform-specific.

## Examples

Minimal startup wiring, e.g. in your bootstrap scene's `onLoad`:

```ts
import { deeplink } from 'db://deeplink/index';

deeplink.onDeeplinkReceived((url) => {
    console.log('deep link received:', url.url);
    if (url.path === '/product') {
        openProductScreen(url.query);
    }
});

await deeplink.initialize();
```

See the runnable demo at the repository root for a full example that
displays the cold-start link, offers a "copy to clipboard" button, and logs
every link received live:

- Scene: [`assets/scene/main.scene`](../../../assets/scene/main.scene)
- Script: [`assets/script/test/DeeplinkTest.ts`](../../../assets/script/test/DeeplinkTest.ts)

## Troubleshooting

- **Build panel shows raw `i18n:deeplink.xxx` strings instead of labels** —
  the `i18n/en.js` / `i18n/zh.js` files are missing a key used by
  `source/builder.ts`. Re-run `npm run build` after editing i18n files
  (`dist/` must be rebuilt, editing `i18n/*.js` alone is enough since i18n is
  not compiled, but a stale Creator cache may need **Developer → Reload
  Extension**).
- **Gradle sync fails with "project ':libdeeplink' not found"** — the
  `settings.gradle` snippet wasn't injected. Confirm `enableDeeplink` is on
  and rebuild; check that `native/engine/android/app/build.gradle` and the
  built project's `settings.gradle` both contain the auto-generated
  `libdeeplink` lines (search for `Generated by Deeplink Extension`).
- **"Duplicate class" during Android build** — usually caused by mixing this
  library with another extension's Android library that both declare the
  same package. `libdeeplink` uses the isolated package
  `com.cocos.deeplink`, so this should not happen unless you've manually
  copied its Java sources elsewhere.
- **CMake error: target `deeplink` not found / duplicate target** — make sure
  `Pre-deeplink.cmake` / `Post-deeplink.cmake` exist only once under
  `native/engine/ios/` (a previous partial build with `enableDeeplink=false`
  should have removed them; if not, delete them and rebuild).
- **Links open the app but `getLink()` / the event returns nothing** —
  double check the `intent-filter` (Android) or `CFBundleURLTypes` /
  Associated Domains (iOS) actually match the link you're testing, and that
  you registered `onDeeplinkReceived` before calling `initialize()`.
- **Android App Links fall back to the browser instead of opening the app** —
  almost always a verification failure. See the [Android
  requirements](./android/index.md) page — `assetlinks.json` must be
  reachable over HTTPS with `Content-Type: application/json`, list the exact
  SHA-256 signing fingerprint used for the build, and `autoVerify` must be
  `true`.
- **iOS Universal Links open Safari instead of the app** — see [iOS
  requirements](./ios/index.md): the `apple-app-site-association` file must
  be served with no redirects, over HTTPS, without a file extension, and the
  Associated Domains capability must be enabled in Xcode with a matching
  `applinks:` entry.

## Known Limitations

- `isDomainAssociated()` and `navigateToOpenByDefaultSettings()` are
  Android-only; both reject with `E_NOT_SUPPORTED` on iOS.
- `isDomainAssociated()` additionally requires Android 12+ (API 31+); below
  that it also rejects with `E_NOT_SUPPORTED` (the OS has no public
  verification-state API before API 31).
- Turning `enableDeeplink` off does **not** retroactively remove
  already-injected `CFBundleURLTypes` / Associated Domains entries from a
  previously built iOS project (only the CMake integration files are
  cleaned up). Clean-build the native project if you need a fully clean
  slate.
- The extension does not parse custom query-parameter schemas or perform
  app-side routing — `DeeplinkUrl` gives you the parsed URL components, and
  routing based on `path`/`query` is left to your game code.
