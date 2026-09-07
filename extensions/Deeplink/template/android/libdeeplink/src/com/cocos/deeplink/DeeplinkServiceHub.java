package com.cocos.deeplink;

import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.pm.verify.domain.DomainVerificationManager;
import android.content.pm.verify.domain.DomainVerificationUserState;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.cocos.lib.GlobalObject;

import org.json.JSONObject;

import java.util.Map;

import com.cocos.deeplink.model.DeeplinkUrl;

/**
 * Central coordinator for the Deeplink extension.
 *
 * <p>Responsibilities:</p>
 * <ul>
 *   <li>Hold the most-recently-received {@link DeeplinkUrl} (warm and cold start)</li>
 *   <li>Dispatch JS method calls received from {@link DeeplinkBridge}</li>
 *   <li>Provide {@link #onDeeplinkUri(Uri)} as the static entry point for
 *       {@link DeeplinkActivity} warm-link hand-offs</li>
 *   <li>Emit {@code deeplinkReceived} events to JS via {@link DeeplinkBridge}</li>
 * </ul>
 *
 * <p>Lifecycle: {@link #init(Context)} is called once from
 * {@link DeeplinkBridge#register(Context)}, which is itself invoked by
 * {@link DeeplinkInitProvider#onCreate()} before the first JS frame.</p>
 *
 * <p>Port notes vs. the Godot original:</p>
 * <ul>
 *   <li>{@code initialize()} reads the activity's launch intent for cold-start
 *       data and flushes it as a {@code deeplinkReceived} event after responding
 *       (instead of relying on {@code onGodotSetupCompleted}).</li>
 *   <li>{@code getLink()} returns the stored DeeplinkUrl JSON (or the activity
 *       intent's current data as a fallback) rather than individual field getters.</li>
 *   <li>{@code clearData()} nulls both the stored link and the activity intent
 *       data, matching the Godot {@code clear_data()} semantics.</li>
 *   <li>{@code isDomainAssociated()} and {@code navigateToOpenByDefaultSettings()}
 *       are direct ports of the Godot equivalents.</li>
 * </ul>
 */
public class DeeplinkServiceHub {

    private static final String TAG = "cocos::DeeplinkServiceHub";

    /** Last received deep-link, or null if none has been received. */
    private static volatile DeeplinkUrl _lastLink = null;

    /** True once {@link #init(Context)} has been called. */
    private static volatile boolean _ready = false;

    // -------------------------------------------------------------------------
    // Initialisation
    // -------------------------------------------------------------------------

    /**
     * Initialise the hub.  Safe to call multiple times — subsequent calls are
     * no-ops.
     *
     * @param context Application context (used for package-manager operations).
     */
    public static synchronized void init(Context context) {
        if (_ready) {
            Log.w(TAG, "init(): already initialised — ignoring.");
            return;
        }
        _ready = true;
        Log.d(TAG, "init(): hub ready.");
    }

    /**
     * Return {@code true} once {@link #init(Context)} has been called.
     * Used by {@link DeeplinkActivity} to choose the warm vs. cold-start path.
     */
    public static boolean isReady() {
        return _ready;
    }

    // -------------------------------------------------------------------------
    // Warm-link entry point — called from DeeplinkActivity (main thread)
    // -------------------------------------------------------------------------

    /**
     * Receive a deep-link URI from {@link DeeplinkActivity} while the game is
     * already running.  Stores the link and emits a {@code deeplinkReceived}
     * event to JS.
     *
     * <p>Called on the Android main thread; {@link DeeplinkBridge#emitEvent}
     * marshals the dispatch onto the Cocos game thread.</p>
     *
     * @param uri Non-null URI extracted from the incoming VIEW intent.
     */
    public static void onDeeplinkUri(Uri uri) {
        Log.d(TAG, "onDeeplinkUri(): uri=" + uri);
        DeeplinkUrl link = new DeeplinkUrl(uri);
        _lastLink = link;
        DeeplinkBridge.emitEvent("deeplinkReceived", link.toJson());
    }

    // -------------------------------------------------------------------------
    // JS dispatch
    // -------------------------------------------------------------------------

    /**
     * Dispatch an incoming JS request to the appropriate handler.
     *
     * @param id     Request identifier echoed in the response envelope.
     * @param method Method name from the JS envelope.
     * @param args   Parsed args object (never null; may be empty).
     */
    public static void dispatch(int id, String method, JSONObject args) {
        switch (method) {
            case "initialize":
                handleInitialize(id);
                break;
            case "getLink":
                handleGetLink(id);
                break;
            case "clearData":
                handleClearData(id);
                break;
            case "isDomainAssociated":
                handleIsDomainAssociated(id, args);
                break;
            case "navigateToOpenByDefaultSettings":
                handleNavigateToOpenByDefaultSettings(id);
                break;
            default:
                Log.w(TAG, "dispatch(): unknown method \"" + method + "\"");
                DeeplinkBridge.respondErr(id, "E_NOT_SUPPORTED",
                        "Unknown method: " + method);
                break;
        }
    }

    // -------------------------------------------------------------------------
    // Method handlers
    // -------------------------------------------------------------------------

    /**
     * Handle {@code initialize} — acknowledge readiness, then flush any
     * cold-start link from the launch intent as a {@code deeplinkReceived}
     * event immediately after responding.
     *
     * <p>Cold-start path: {@link DeeplinkActivity} detected the game was not
     * yet running and forwarded the URI via {@code setData()} on the launch
     * intent.  Here we read that URI back from the activity's current intent.</p>
     */
    private static void handleInitialize(final int id) {
        Log.d(TAG, "handleInitialize()");
        DeeplinkBridge.respondOk(id, null);

        // Flush cold-start link from the launch intent (if any).
        // This runs on the Cocos game thread; GlobalObject.getActivity() is safe here.
        Activity activity = GlobalObject.getActivity();
        if (activity == null) {
            Log.w(TAG, "handleInitialize(): activity is null — cannot check launch intent.");
            return;
        }

        Intent launchIntent = activity.getIntent();
        if (launchIntent == null) {
            return;
        }

        Uri uri = launchIntent.getData();
        if (uri != null) {
            Log.d(TAG, "handleInitialize(): flushing cold-start uri=" + uri);
            DeeplinkUrl link = new DeeplinkUrl(uri);
            _lastLink = link;
            // Emit after respond so JS receives the response first.
            DeeplinkBridge.emitEvent("deeplinkReceived", link.toJson());
        }
    }

    /**
     * Handle {@code getLink} — return the last stored DeeplinkUrl, or fall
     * back to the activity's current intent data if none is stored.
     */
    private static void handleGetLink(int id) {
        Log.d(TAG, "handleGetLink()");

        if (_lastLink != null) {
            DeeplinkBridge.respondOk(id, _lastLink.toJson());
            return;
        }

        // Fallback: check activity intent directly (e.g. called before initialize)
        Activity activity = GlobalObject.getActivity();
        if (activity != null) {
            Intent intent = activity.getIntent();
            if (intent != null) {
                Uri uri = intent.getData();
                if (uri != null) {
                    DeeplinkUrl link = new DeeplinkUrl(uri);
                    DeeplinkBridge.respondOk(id, link.toJson());
                    return;
                }
            }
        }

        DeeplinkBridge.respondOk(id, null);
    }

    /**
     * Handle {@code clearData} — null the stored link and clear the activity
     * intent's data URI, matching the Godot {@code clear_data()} semantics.
     */
    private static void handleClearData(int id) {
        Log.d(TAG, "handleClearData()");
        _lastLink = null;

        Activity activity = GlobalObject.getActivity();
        if (activity != null) {
            Intent intent = activity.getIntent();
            if (intent != null) {
                intent.setData(null);
                Log.d(TAG, "handleClearData(): activity intent data cleared.");
            }
        }

        DeeplinkBridge.respondOk(id, null);
    }

    /**
     * Handle {@code isDomainAssociated} — port of the Godot
     * {@code is_domain_associated()} method using
     * {@link DomainVerificationManager} (API 31+).
     *
     * <p>Responds with {@code {"associated": bool}} on API 31+.
     * Responds with {@code E_NOT_SUPPORTED} on API &lt; 31.</p>
     */
    private static void handleIsDomainAssociated(int id, JSONObject args) {
        String domain = args.optString("domain", "");
        Log.d(TAG, "handleIsDomainAssociated(): domain=" + domain);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            Log.e(TAG, "handleIsDomainAssociated(): API " + Build.VERSION.SDK_INT
                    + " < 31 — not supported.");
            DeeplinkBridge.respondErr(id, "E_NOT_SUPPORTED",
                    "DomainVerificationManager requires API 31+. Current: "
                            + Build.VERSION.SDK_INT);
            return;
        }

        Activity activity = GlobalObject.getActivity();
        if (activity == null) {
            DeeplinkBridge.respondErr(id, "E_NOT_INITIALIZED", "Activity is null.");
            return;
        }

        Context context = activity.getApplicationContext();
        DomainVerificationManager manager =
                context.getSystemService(DomainVerificationManager.class);

        boolean associated = false;
        try {
            DomainVerificationUserState userState =
                    manager.getDomainVerificationUserState(context.getPackageName());
            if (userState != null) {
                Map<String, Integer> hostToStateMap = userState.getHostToStateMap();
                if (hostToStateMap.containsKey(domain)) {
                    Integer stateValue = hostToStateMap.get(domain);
                    if (stateValue != null) {
                        switch (stateValue) {
                            case DomainVerificationUserState.DOMAIN_STATE_VERIFIED:
                                associated = true;
                                Log.i(TAG, "isDomainAssociated(): " + domain + " → VERIFIED");
                                break;
                            case DomainVerificationUserState.DOMAIN_STATE_SELECTED:
                                associated = true;
                                Log.i(TAG, "isDomainAssociated(): " + domain + " → SELECTED");
                                break;
                            case DomainVerificationUserState.DOMAIN_STATE_NONE:
                                Log.w(TAG, "isDomainAssociated(): " + domain + " → NONE");
                                break;
                            default:
                                Log.e(TAG, "isDomainAssociated(): " + domain
                                        + " → unknown state " + stateValue);
                                break;
                        }
                    } else {
                        Log.e(TAG, "isDomainAssociated(): state for " + domain + " is null.");
                    }
                } else {
                    Log.e(TAG, "isDomainAssociated(): " + domain + " not found in host map.");
                }
            }
        } catch (PackageManager.NameNotFoundException e) {
            Log.e(TAG, "isDomainAssociated(): package not found: "
                    + context.getPackageName(), e);
            DeeplinkBridge.respondErr(id, "E_PACKAGE_NOT_FOUND",
                    "Package not found: " + context.getPackageName());
            return;
        }

        try {
            JSONObject data = new JSONObject();
            data.put("associated", associated);
            DeeplinkBridge.respondOk(id, data);
        } catch (org.json.JSONException e) {
            Log.e(TAG, "isDomainAssociated(): JSON build failed", e);
            DeeplinkBridge.respondErr(id, "E_INTERNAL", "JSON build error: " + e.getMessage());
        }
    }

    /**
     * Handle {@code navigateToOpenByDefaultSettings} — port of the Godot
     * {@code navigate_to_open_by_default_settings()} method.
     *
     * <p>On API 31+ (Android 12+): opens the "Open by default" settings screen,
     * with a Samsung OneUI &lt; 5.0 fallback to {@code MANAGE_DOMAIN_URLS}
     * (same logic as the original).</p>
     *
     * <p>On API &lt; 31: responds with {@code E_NOT_SUPPORTED}.</p>
     */
    private static void handleNavigateToOpenByDefaultSettings(int id) {
        Log.d(TAG, "handleNavigateToOpenByDefaultSettings()");

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            Log.e(TAG, "navigateToOpenByDefaultSettings(): API " + Build.VERSION.SDK_INT
                    + " < 31 — not supported.");
            DeeplinkBridge.respondErr(id, "E_NOT_SUPPORTED",
                    "ACTION_APP_OPEN_BY_DEFAULT_SETTINGS requires API 31+. Current: "
                            + Build.VERSION.SDK_INT);
            return;
        }

        Activity activity = GlobalObject.getActivity();
        if (activity == null) {
            DeeplinkBridge.respondErr(id, "E_NOT_INITIALIZED", "Activity is null.");
            return;
        }

        Context context = activity.getApplicationContext();

        // Samsung OneUI version check — avoid a known bug in OneUI < 5.0 where
        // ACTION_APP_OPEN_BY_DEFAULT_SETTINGS causes a crash; fall back to the
        // legacy MANAGE_DOMAIN_URLS screen instead.
        int oneUiVersion = -1;
        try {
            oneUiVersion = Build.VERSION.class
                    .getDeclaredField("SEM_PLATFORM_INT")
                    .getInt(null);
        } catch (NoSuchFieldException e) {
            Log.d(TAG, "navigateToOpenByDefaultSettings(): no SEM_PLATFORM_INT — not OneUI.");
        } catch (IllegalAccessException e) {
            Log.w(TAG, "navigateToOpenByDefaultSettings(): cannot read SEM_PLATFORM_INT.", e);
        }

        if (oneUiVersion < 0 || oneUiVersion >= 140000) {
            // Standard path: ACTION_APP_OPEN_BY_DEFAULT_SETTINGS
            Log.i(TAG, "navigateToOpenByDefaultSettings(): opening 'Open By Default' screen.");
            Intent intent = new Intent(
                    Settings.ACTION_APP_OPEN_BY_DEFAULT_SETTINGS,
                    Uri.parse("package:" + context.getPackageName()));
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        } else {
            // OneUI < 5.0 fallback: MANAGE_DOMAIN_URLS
            Log.i(TAG, "navigateToOpenByDefaultSettings(): OneUI < 5.0 — opening MANAGE_DOMAIN_URLS.");
            Intent intent = new Intent();
            intent.setAction("android.settings.MANAGE_DOMAIN_URLS");
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        }

        DeeplinkBridge.respondOk(id, null);
    }
}
