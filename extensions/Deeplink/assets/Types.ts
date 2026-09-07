/**
 * Deeplink extension — public types.
 *
 * Import via the barrel:
 *   import { DeeplinkUrl, DeeplinkError } from 'db://deeplink/index';
 */

// ============================================================================
// URL type
// ============================================================================

/**
 * A parsed deep-link URL delivered to the app at cold start or at runtime.
 *
 * All fields that are absent or not applicable in the original URL are
 * returned as empty string (`""`). Optional fields are `undefined` when
 * not present in the URL.
 *
 * Example — `myapp://example.com:8080/path/to/resource?key=val#anchor`:
 *   url            = "myapp://example.com:8080/path/to/resource?key=val#anchor"
 *   scheme         = "myapp"
 *   host           = "example.com"
 *   port           = 8080
 *   path           = "/path/to/resource"
 *   pathExtension  = ""           (no file extension on last component)
 *   pathComponents = ["/", "path", "to", "resource"]
 *   query          = "key=val"
 *   fragment       = "anchor"
 */
export interface DeeplinkUrl {
    /**
     * The full original URL string (e.g. `"myapp://host/path?q=1"`).
     * Empty string when no link is present.
     */
    url: string;

    /**
     * URL scheme, without the trailing `"://"` (e.g. `"myapp"`, `"https"`).
     * Empty string when absent.
     */
    scheme: string;

    /**
     * Host component of the URL (e.g. `"example.com"`).
     * Empty string when absent.
     */
    host: string;

    /**
     * Port number, if explicitly specified in the URL (e.g. `8080`).
     * `undefined` when no port is present.
     */
    port?: number;

    /**
     * Path component, including the leading slash (e.g. `"/items/42"`).
     * Empty string when absent.
     */
    path: string;

    /**
     * File extension of the last path component, without the leading dot
     * (e.g. `"html"` for `/page.html`).
     * Empty string when absent or when the last component has no extension.
     */
    pathExtension?: string;

    /**
     * All path components as an array.
     * On iOS this follows `URL.pathComponents` semantics: the first element is
     * `"/"` for an absolute path, followed by each segment.
     * Example: `"/a/b"` → `["/", "a", "b"]`.
     * `undefined` or empty array when the path is absent.
     */
    pathComponents?: string[];

    /**
     * Raw query string, without the leading `"?"` (e.g. `"key=val&other=2"`).
     * `undefined` when no query is present.
     */
    query?: string;

    /**
     * Fragment identifier, without the leading `"#"` (e.g. `"section-2"`).
     * `undefined` when no fragment is present.
     */
    fragment?: string;

    /**
     * User info — username component of the URL (e.g. `"alice"` in
     * `scheme://alice:pw@host/`).
     * `undefined` when not present.
     */
    user?: string;

    /**
     * User info — password component of the URL (e.g. `"secret"` in
     * `scheme://alice:secret@host/`).
     * `undefined` when not present.
     */
    password?: string;
}

// ============================================================================
// Error type
// ============================================================================

/**
 * Error object rejected by any Deeplink call.
 *
 * Built-in codes:
 *   `E_NOT_SUPPORTED` — method called on a non-native platform (web / editor),
 *                       or an Android-only method called on iOS, or an iOS-only
 *                       method called on Android.
 *   `E_TIMEOUT`       — no response from the native side within the timeout window.
 *   Any platform-specific code returned by the native layer.
 */
export interface DeeplinkError {
    /** Machine-readable error code string. */
    code: string;
    /** Human-readable description of the error. */
    message: string;
}
