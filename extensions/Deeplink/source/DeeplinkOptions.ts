/*
 Deeplink — Universal Links (Android App Links + iOS Universal Links / Custom URL Schemes)
 extension for Cocos Creator 3.8.8

 MIT License
*/

/**
 * @en
 * DeeplinkOption holds the build-panel configuration for the Deeplink extension.
 * Options are read during the post-build hook via `options.packages['deeplink']`.
 *
 * Android-specific options control the intent-filter generation inside the
 * DeeplinkActivity's AndroidManifest.xml.
 *
 * iOS-specific options control CFBundleURLTypes injection in Info.plist and
 * Associated Domains injection in the project's .entitlements file.
 */
export interface DeeplinkOption {
    // ---- shared ----

    /**
     * @en
     * Enable or disable the Deeplink extension entirely.
     * When false, library copy and all manifest/plist/entitlements injections are skipped.
     * Previously-injected plist/entitlements entries are NOT automatically removed
     * (manual cleanup required) — only the cmake files are cleaned up on iOS.
     */
    enableDeeplink?: boolean;

    /**
     * @en
     * Force-overwrite the native library directory in the built project on every build,
     * even when it already exists.  Disable to preserve manual edits.
     */
    overwriteLibrary?: boolean;

    // ---- Android-only ----

    /**
     * @en
     * The URI scheme for the Android intent-filter (e.g. "https", "http", "myapp").
     * Leave empty to skip intent-filter injection entirely.
     * For App Links (autoVerify), use "https".
     */
    scheme?: string;

    /**
     * @en
     * The host for the Android intent-filter (e.g. "example.com").
     * Leave empty to omit the android:host attribute.
     * When scheme is "http" or "https" and host is empty, a build warning is emitted.
     */
    host?: string;

    /**
     * @en
     * The path prefix for the Android intent-filter (e.g. "/app").
     * Leave empty to omit the android:pathPrefix attribute.
     */
    pathPrefix?: string;

    /**
     * @en
     * When true, sets android:autoVerify="true" on the intent-filter element,
     * enabling Android App Links verification.
     */
    autoVerify?: boolean;

    /**
     * @en
     * Optional android:label attribute on the intent-filter element.
     * Leave empty to omit the attribute.
     */
    label?: string;

    // ---- iOS-only ----

    /**
     * @en
     * Custom URL scheme to register in CFBundleURLTypes (e.g. "myapp").
     * Leave empty to skip CFBundleURLTypes injection.
     */
    urlScheme?: string;

    /**
     * @en
     * Comma-separated Associated Domains to add to the .entitlements file
     * under com.apple.developer.associated-domains (e.g. "applinks:example.com").
     * Leave empty to skip entitlements injection.
     */
    associatedDomains?: string;
}
