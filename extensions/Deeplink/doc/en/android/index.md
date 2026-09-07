# Cocos Deeplink — Android Requirements (English)

This page covers everything Android-specific: what the extension injects
automatically, and — the part most people get wrong — how to correctly set
up **Android App Links** so `https://` links open your app instead of (or in
addition to) the browser.

## What the extension does for you

On every Android build, when `enableDeeplink` is on, the extension:

1. Copies `template/android/libdeeplink/` into the built project as
   `proj/libdeeplink` — a small Android library module (package
   `com.cocos.deeplink`) containing `DeeplinkActivity` (a transparent
   trampoline that receives `ACTION_VIEW` intents) and
   `DeeplinkInitProvider` (a `ContentProvider` that registers the JS bridge
   listener before `Application.onCreate()` runs, so no link is missed even
   if the app is cold-started by the link itself).
2. Appends `include ':libdeeplink'` to `settings.gradle` and an
   `implementation project(':libdeeplink')` dependency to
   `native/engine/android/app/build.gradle` — both insertions are
   idempotent (checked for a marker before appending), so building twice
   does not duplicate them.
3. Generates an `<intent-filter>` block from the build panel options
   (`scheme`, `host`, `pathPrefix`, `autoVerify`, `label`) and substitutes it
   into `libdeeplink`'s `AndroidManifest.xml` in place of the
   `<!-- DEEPLINK_INTENT_FILTER -->` placeholder.

None of this alone makes `https://` links open your app — Android requires
you to also **prove domain ownership**, which is the App Links verification
step below.

## Permissions / Capabilities

No dangerous permissions are required. `DeeplinkActivity` is
`android:exported="true"` (required so the OS/other apps can deliver
`ACTION_VIEW` intents to it) but does nothing beyond forward the URI to the
JS bridge and finish itself — it declares no other capability.

## Setting up Android App Links (the part people get wrong)

Follow these steps precisely — a single mismatch (wrong fingerprint, wrong
content type, a redirect) silently breaks verification and Android falls
back to opening the link in the browser instead of your app.

### 1. Configure the build panel

On the **Android** tab of the build panel:

- `scheme` = `https`
- `host` = your real domain, e.g. `example.com`
- `autoVerify` = `true` (default)

This produces an intent-filter equivalent to:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="https" android:host="example.com"/>
</intent-filter>
```

### 2. Get your signing certificate's SHA-256 fingerprint

App Links verification is tied to the exact certificate the APK/AAB is
signed with. Get the fingerprint for the keystore you build with:

```bash
keytool -list -v -keystore /path/to/your.keystore -alias your-key-alias
```

Look for the line `SHA256:` — it looks like:

```
SHA256: 14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A3:79:80:D9:6C:BD:56:C7:A9:83:0F:DC:8C:B4:37
```

- **If you publish through the Google Play App Signing** program (the
  default for new apps), the fingerprint you need is Play's **App signing
  key certificate**, found in Play Console → *Setup* → *App integrity* →
  *App signing key certificate* — not your local upload keystore.
- For internal/sideloaded builds, use the fingerprint of the keystore you
  actually sign with.
- You can list multiple fingerprints in `assetlinks.json` (e.g. debug +
  release) — see below.

### 3. Host `assetlinks.json`

Create and host this file at exactly:

```
https://example.com/.well-known/assetlinks.json
```

Content:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.yourcompany.yourapp",
      "sha256_cert_fingerprints": [
        "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A3:79:80:D9:6C:BD:56:C7:A9:83:0F:DC:8C:B4:37"
      ]
    }
  }
]
```

Hosting requirements (Android checks every one of these):

- Served over **HTTPS** (plain HTTP is rejected).
- Reachable with **no redirects** (not even HTTP→HTTPS — host it directly on
  the HTTPS URL).
- `Content-Type: application/json` (some static hosts default to
  `text/plain` or `application/octet-stream` for `.json` — verify with
  `curl -I`).
- Publicly reachable without authentication, geographic blocking, or a
  robots-disallowed path that a CDN might otherwise strip.
- `package_name` must exactly match your app's `applicationId`.
- `sha256_cert_fingerprints` must exactly match the certificate used to sign
  the build under test (colon-separated, uppercase hex, as printed by
  `keytool`).

Quick check before you rely on it:

```bash
curl -sI https://example.com/.well-known/assetlinks.json | grep -i content-type
curl -s  https://example.com/.well-known/assetlinks.json | python3 -m json.tool
```

Google also provides a validator:
https://developers.google.com/digital-asset-links/tools/generator

### 4. Rebuild and verify

Android performs the verification automatically at install time (API 31+)
or app-link-time (API 23–30) — you do not call any extension API to
"trigger" it. To check the *result* at runtime (API 31+ only):

```ts
import { deeplink } from 'db://deeplink/index';

const associated = await deeplink.isDomainAssociated('example.com');
console.log('App Links verified for example.com:', associated);
```

You can also inspect verification state via ADB:

```bash
adb shell pm get-app-links com.yourcompany.yourapp
```

or send the user to the system settings screen to fix it manually:

```ts
await deeplink.navigateToOpenByDefaultSettings();
```

### Common verification failures

| Symptom | Likely cause |
| --- | --- |
| Link opens in the browser, not the app | `assetlinks.json` unreachable, wrong content-type, or a redirect in the chain |
| `pm get-app-links` shows `verify failed` | Fingerprint mismatch — you likely hosted the *upload* key fingerprint but Play re-signed with the *App signing key* |
| Works on some devices, not others | Google Play Services needs connectivity to fetch `assetlinks.json` at install time on API 31+; a device that installed the APK offline (sideload) may need a manual domain verification (`adb shell pm verify-app-links --re-verify <package>`, requires `adb shell` on a debug-enabled device) |
| Works right after `adb install`, fails from Play Store | The Play Store install path performs verification independently — re-check the fingerprint is the **Play App Signing** one, not your local key |

## Build Configuration

- `minSdkVersion` / `compileSdkVersion` / `targetSdkVersion` are read from
  your project's global Android build settings (`PROP_MIN_SDK_VERSION` etc.)
  — the extension does not hardcode or override them.
- The library's own `build.gradle` requires `androidx.core:core:1.13.1` and
  a project dependency on `:libcocos` (provided by the Cocos native
  template).

## Known Limitations

- `autoVerify` verification itself is entirely OS-driven; the extension only
  sets the manifest flag and cannot force re-verification (`adb shell pm
  verify-app-links --re-verify` is your tool for that during testing).
- `isDomainAssociated()` requires API 31+; there is no equivalent
  programmatic check for older devices — rely on `pm get-app-links` (ADB) or
  manual testing.
