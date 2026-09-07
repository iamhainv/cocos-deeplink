package com.cocos.deeplink;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

/**
 * Transparent trampoline activity that receives ACTION_VIEW deep-link intents
 * and routes them to the game process.
 *
 * <p>This is a faithful port of
 * {@code org.godotengine.plugin.deeplink.DeeplinkActivity}, adapted to the
 * Cocos bridge architecture:</p>
 *
 * <ul>
 *   <li>The "is game running" guard uses {@link DeeplinkServiceHub#isReady()}
 *       (ContentProvider init flag) instead of {@code DeeplinkPlugin.instance}.</li>
 *   <li>Warm-link hand-off calls {@link DeeplinkServiceHub#onDeeplinkUri(Uri)}
 *       (which stores + emits the event) instead of directly emitting a Godot
 *       signal.</li>
 *   <li>Cold-start path forwards the URI via {@code setData()} on the launch
 *       intent so {@link DeeplinkServiceHub#handleInitialize} can pick it up.</li>
 * </ul>
 *
 * <h3>Cold-start path</h3>
 * <p>The game process is not yet running ({@link DeeplinkServiceHub#isReady()}
 * returns {@code false}).  We obtain the default launch intent via
 * {@link android.content.pm.PackageManager#getLaunchIntentForPackage}, copy the
 * deep-link URI onto it ({@code setData} + {@code putExtras}), start it, then
 * {@code finish()} this trampoline.  The game's main activity receives the URI
 * via {@code getIntent().getData()}, which {@link DeeplinkServiceHub}
 * reads during the JS {@code initialize} call.</p>
 *
 * <h3>Warm-link path</h3>
 * <p>The game process is already running.  We hand the URI to
 * {@link DeeplinkServiceHub#onDeeplinkUri(Uri)}, which stores it and emits a
 * {@code deeplinkReceived} event to JS.  We then bring the game activity to the
 * foreground by starting the launch intent with
 * {@code NEW_TASK | CLEAR_TOP | SINGLE_TOP}, then {@code finish()} the
 * trampoline.  This matches the Godot original's foreground-recovery logic.</p>
 *
 * <h3>Intent-filter</h3>
 * <p>The {@code <!-- DEEPLINK_INTENT_FILTER -->} placeholder in
 * {@code AndroidManifest.xml} is replaced at build time by the project's
 * generated {@code <intent-filter>} block.  This activity has no hard-coded
 * scheme or host; all routing is configured by the build hook.</p>
 */
public class DeeplinkActivity extends Activity {

    private static final String TAG = "cocos::DeeplinkActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "onCreate()");

        Intent intent = getIntent();
        Uri uri = checkIntent(intent);
        if (uri != null) {
            handleUri(intent, uri);
        } else {
            finish();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Log.d(TAG, "onNewIntent(): intent=" + intent);

        Uri uri = checkIntent(intent);
        if (uri != null) {
            handleUri(intent, uri);
        } else {
            finish();
        }
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /**
     * Route a validated URI to either the cold-start or warm-start path.
     *
     * @param intent Original intent carrying the URI.
     * @param uri    Non-null URI extracted by {@link #checkIntent}.
     */
    private void handleUri(Intent intent, Uri uri) {
        if (!DeeplinkServiceHub.isReady()) {
            // Cold start: game process is not yet running.
            // Forward the URI via the launch intent so the main activity
            // receives it through getIntent().getData().
            Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launchIntent != null) {
                launchIntent.setData(intent.getData());
                launchIntent.putExtras(intent);
                Log.d(TAG, "handleUri(): cold start — launching game with uri=" + uri);
                startActivity(launchIntent);
            } else {
                Log.e(TAG, "handleUri(): cold start — no launch intent found for package "
                        + getPackageName());
            }
        } else {
            // Warm link: game process is already running.
            // Hand the URI to the hub (stores + emits deeplinkReceived to JS).
            Log.i(TAG, "handleUri(): warm link — game already running, uri=" + uri);
            DeeplinkServiceHub.onDeeplinkUri(uri);

            // Bring the existing game activity to the foreground.
            Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launchIntent != null) {
                launchIntent.setFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK |
                        Intent.FLAG_ACTIVITY_CLEAR_TOP |
                        Intent.FLAG_ACTIVITY_SINGLE_TOP);
                startActivity(launchIntent);
            } else {
                Log.e(TAG, "handleUri(): warm link — no launch intent found for package "
                        + getPackageName());
            }
        }

        finish();
    }

    /**
     * Extract and validate the data URI from an intent.
     *
     * @param intent Incoming intent (may be null).
     * @return The URI if present and non-null; {@code null} otherwise.
     */
    static Uri checkIntent(Intent intent) {
        if (intent == null) {
            Log.d(TAG, "checkIntent(): intent is null.");
            return null;
        }

        Uri uri = intent.getData();
        if (uri != null) {
            Log.d(TAG, "checkIntent(): received deep-link uri=" + uri);
        } else {
            Log.d(TAG, "checkIntent(): uri is null for intent=" + intent);
        }
        return uri;
    }
}
