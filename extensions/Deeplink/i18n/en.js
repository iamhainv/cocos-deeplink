module.exports = {
    title: 'Deeplink — Universal Links (Android App Links + iOS Universal Links / Custom URL Schemes)',
    description: 'Deeplink — injects intent-filter (Android App Links) and CFBundleURLTypes / Associated Domains (iOS Universal Links) into the built native project.',

    // ---- shared ----
    enableDeeplink: {
        title: 'Enable Deeplink',
        tip: 'Enable or disable the Deeplink extension entirely. When false, library copy and all manifest/plist/entitlements injections are skipped.',
    },
    overwriteLibrary: {
        title: 'Force overwrite the Deeplink library',
        tip: 'Force overwrite the native library files in the built project from the extension template on every build. Disable to preserve manual edits.',
    },

    // ---- Android ----
    scheme: {
        title: 'URI Scheme (Android)',
        tip: 'The URI scheme for the Android intent-filter (e.g. "https", "http", or a custom scheme). Leave empty to skip intent-filter injection.',
    },
    host: {
        title: 'Host (Android)',
        tip: 'The host for the Android intent-filter (e.g. "example.com"). Required when scheme is "http" or "https" for App Links to work correctly.',
    },
    pathPrefix: {
        title: 'Path Prefix (Android)',
        tip: 'Optional path prefix for the Android intent-filter (e.g. "/app"). Leave empty to omit the android:pathPrefix attribute.',
    },
    autoVerify: {
        title: 'Auto Verify (Android App Links)',
        tip: 'When enabled, sets android:autoVerify="true" on the intent-filter element, enabling Android App Links domain verification.',
    },
    label: {
        title: 'Intent Filter Label (Android)',
        tip: 'Optional android:label attribute for the intent-filter element. Leave empty to omit.',
    },

    // ---- iOS ----
    urlScheme: {
        title: 'URL Scheme (iOS)',
        tip: 'Custom URL scheme to register in CFBundleURLTypes in Info.plist (e.g. "myapp"). Leave empty to skip URL scheme injection.',
    },
    associatedDomains: {
        title: 'Associated Domains (iOS Universal Links)',
        tip: 'Comma-separated Associated Domains to add to the .entitlements file under com.apple.developer.associated-domains (e.g. "applinks:example.com"). Leave empty to skip.',
    },
};
