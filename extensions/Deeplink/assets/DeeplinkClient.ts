/**
 * Deeplink extension — DeeplinkClient — Cocos Creator 3.8.8
 *
 * Public API for receiving and querying deep-link URLs on iOS and Android.
 * All methods are async and delegate to the native side via deeplinkBridge.call().
 *
 * Usage:
 *   import { deeplink } from 'db://deeplink/index';
 *
 *   // ── Cold-start flow (app opened via a deep link) ──────────────────────
 *   // Register handlers BEFORE calling initialize(). The native side buffers
 *   // the cold-start URL and flushes it as a `deeplinkReceived` event during
 *   // the initialize() call. If you register after initialize() you will miss
 *   // that first event.
 *   deeplink.onDeeplinkReceived((url) => {
 *       console.log('opened via link:', url.url);
 *       routeTo(url.path);
 *   });
 *   await deeplink.initialize();
 *
 *   // ── Warm flow (app already running, link arrives) ─────────────────────
 *   // The `deeplinkReceived` event fires whenever the OS delivers a new URL
 *   // to the running app (e.g. the user taps a link while the app is in the
 *   // background). The handler registered above is sufficient for both flows.
 *
 *   // ── Query the last received URL at any time ───────────────────────────
 *   const url = await deeplink.getLink();
 *   if (url.url !== '') { handleLink(url); }
 *
 *
 * Android App Links (autoVerify):
 *   To handle `https://` universal links on Android you must:
 *   1. Add `android:autoVerify="true"` and the matching `<data>` element to
 *      your intent-filter in AndroidManifest.xml.
 *   2. Host a valid Digital Asset Links file at:
 *      https://<your-domain>/.well-known/assetlinks.json
 *   See: https://developer.android.com/training/app-links/verify-android-applinks
 *   Use `isDomainAssociated()` (Android 12+) to check runtime verification state.
 *
 * iOS Universal Links:
 *   To handle `https://` universal links on iOS you must:
 *   1. Enable the Associated Domains capability in Xcode and add
 *      `applinks:<your-domain>` to the entitlements.
 *   2. Host an Apple App Site Association (AASA) file at:
 *      https://<your-domain>/.well-known/apple-app-site-association
 *   See: https://developer.apple.com/documentation/xcode/supporting-associated-domains
 *   `isDomainAssociated()` is not available on iOS (rejects with E_NOT_SUPPORTED).
 *
 * Platform notes:
 *   - `isDomainAssociated()` is only meaningful on Android 12+ (API 31+).
 *     On iOS and on Android below API 31 it rejects with E_NOT_SUPPORTED.
 *   - `navigateToOpenByDefaultSettings()` opens the Android "Open by default"
 *     settings screen. On iOS it rejects with E_NOT_SUPPORTED.
 */

import { deeplinkBridge } from './core/Bridge';
import { DeeplinkUrl } from './Types';

// ---------------------------------------------------------------------------
// Wire result types (match native response `data` payloads)
// ---------------------------------------------------------------------------

interface _VoidData {}

interface _AssociatedData {
    associated: boolean;
}

// ---------------------------------------------------------------------------
// DeeplinkClient
// ---------------------------------------------------------------------------

/**
 * Cross-platform deep-link client.
 *
 * Obtain the singleton via the exported `deeplink` constant.
 * Do not instantiate directly.
 */
export class DeeplinkClient {

    // ------------------------------------------------------------------
    // Initialisation
    // ------------------------------------------------------------------

    /**
     * Initialise the deep-link system. Must be called once at app startup.
     *
     * **Register `onDeeplinkReceived` handlers BEFORE calling this method.**
     * The native side buffers the cold-start URL (the link that launched the
     * app) and delivers it as a `deeplinkReceived` event synchronously inside
     * this call. Handlers registered after `initialize()` returns will miss
     * the cold-start delivery.
     *
     * After this promise resolves, the system is fully active and any
     * subsequent incoming URLs (warm-start) will be delivered via the
     * `deeplinkReceived` event as they arrive.
     *
     * @throws {@link DeeplinkError} with code `E_NOT_SUPPORTED` on non-native
     *         platforms (web / Cocos editor preview).
     */
    public initialize(): Promise<void> {
        return deeplinkBridge.call<_VoidData>('initialize', {}).then(() => undefined);
    }

    // ------------------------------------------------------------------
    // Query
    // ------------------------------------------------------------------

    /**
     * Return the current (or most recently received) deep-link URL.
     *
     * When no link has been received yet (or after `clearData()` is called),
     * all string fields in the returned {@link DeeplinkUrl} are empty strings
     * and optional fields are absent.
     *
     * You can inspect `url.url !== ''` to determine whether a link is present.
     *
     * @throws {@link DeeplinkError} on native failure.
     */
    public getLink(): Promise<DeeplinkUrl> {
        return deeplinkBridge.call<DeeplinkUrl>('getLink', {});
    }

    /**
     * Clear the stored deep-link data on both iOS and Android.
     *
     * After this call, `getLink()` will return an all-empty {@link DeeplinkUrl}
     * until a new link arrives. Use this after you have consumed and handled
     * the current link to prevent it from being re-processed on the next cold
     * start or query.
     *
     * @throws {@link DeeplinkError} on native failure.
     */
    public clearData(): Promise<void> {
        return deeplinkBridge.call<_VoidData>('clearData', {}).then(() => undefined);
    }

    // ------------------------------------------------------------------
    // Android App Links — domain verification (Android 12+ only)
    // ------------------------------------------------------------------

    /**
     * Check whether the given domain has been verified as an associated
     * Android App Link for this app.
     *
     * This reflects the Android 12+ (API 31+) App Links autoVerify state.
     * Verification succeeds when the Digital Asset Links file at
     * `https://<domain>/.well-known/assetlinks.json` is reachable and
     * correctly references this app's package name and signing certificate.
     *
     * **Android 12+ only.** On iOS and on Android below API 31 this always
     * rejects with `{ code: 'E_NOT_SUPPORTED' }`.
     *
     * @param domain  The domain to check (e.g. `"example.com"`).
     * @returns `true` if the domain is verified as an App Link for this app.
     *
     * @throws {@link DeeplinkError} with code `E_NOT_SUPPORTED` on iOS or
     *         Android below API 31.
     */
    public isDomainAssociated(domain: string): Promise<boolean> {
        return deeplinkBridge.call<_AssociatedData>('isDomainAssociated', { domain })
            .then((data) => data.associated);
    }

    // ------------------------------------------------------------------
    // Android-only: Open by default settings
    // ------------------------------------------------------------------

    /**
     * Navigate the user to the Android "Open by default" settings screen for
     * this app, where they can configure which link domains open in the app.
     *
     * The promise resolves when the user returns to the app (i.e. after they
     * have made their selection or dismissed the screen). Uses an unlimited
     * timeout internally since the user may spend an arbitrary amount of time
     * on the settings screen.
     *
     * **Android only.** On iOS this always rejects with
     * `{ code: 'E_NOT_SUPPORTED' }`.
     *
     * @throws {@link DeeplinkError} with code `E_NOT_SUPPORTED` on iOS.
     */
    public navigateToOpenByDefaultSettings(): Promise<void> {
        // timeout 0 — user navigates to system settings; duration is arbitrary
        return deeplinkBridge.call<_VoidData>('navigateToOpenByDefaultSettings', {}, 0)
            .then(() => undefined);
    }

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    /**
     * Subscribe to the `deeplinkReceived` event, fired whenever the app
     * receives a deep-link URL.
     *
     * This covers two flows:
     *
     * **Cold start**: The app was launched by the OS in response to a link
     * click. The event is delivered once during `initialize()`. To capture it,
     * call `onDeeplinkReceived()` BEFORE calling `initialize()`.
     *
     * **Warm / foreground**: The app was already running (foreground or
     * background) when a new link arrived. The event fires at any time after
     * `initialize()` resolves.
     *
     * The payload is a {@link DeeplinkUrl} object with all components parsed.
     *
     * @param handler  Callback receiving the parsed deep-link URL.
     */
    public onDeeplinkReceived(handler: (url: DeeplinkUrl) => void): void {
        deeplinkBridge.on('deeplinkReceived', handler as (p: unknown) => void);
    }

    /**
     * Unsubscribe from the `deeplinkReceived` event.
     *
     * @param handler  The exact handler reference passed to
     *                 {@link onDeeplinkReceived}.
     */
    public offDeeplinkReceived(handler: (url: DeeplinkUrl) => void): void {
        deeplinkBridge.off('deeplinkReceived', handler as (p: unknown) => void);
    }
}

/** Singleton deep-link client. Import this in your game code. */
export const deeplink = new DeeplinkClient();
