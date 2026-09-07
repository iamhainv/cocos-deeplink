package com.cocos.deeplink;

import android.util.Log;

import com.cocos.lib.CocosHelper;
import com.cocos.lib.JsbBridgeWrapper;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Wire-protocol bridge between the Cocos JS layer and
 * {@link DeeplinkServiceHub}.
 *
 * <p>Registers a {@link JsbBridgeWrapper} script-event listener on channel
 * {@code "deeplink"}.  All JS-to-native messages arrive as a JSON string:</p>
 * <pre>
 *   { "id": &lt;int&gt;, "method": "...", "args": { ... } }
 * </pre>
 *
 * <p>All native-to-JS messages are dispatched as JSON on the same channel:</p>
 * <pre>
 *   Response (ok):  { "kind":"response","id":N,"success":true,"data":{...} }
 *   Response (err): { "kind":"response","id":N,"success":false,
 *                     "error":{"code":"...","message":"..."} }
 *   Event:          { "kind":"event","name":"deeplinkReceived","payload":{...} }
 * </pre>
 *
 * <p>Thread safety: JsbBridgeWrapper listener fires on the Cocos game thread.
 * Dispatches originating from {@link DeeplinkActivity} (main thread) are
 * marshalled back via {@link CocosHelper#runOnGameThread(Runnable)}.</p>
 */
public class DeeplinkBridge {

    private static final String TAG     = "cocos::DeeplinkBridge";
    private static final String CHANNEL = "deeplink";

    /**
     * Register the JsbBridgeWrapper listener.  Called once from
     * {@link DeeplinkInitProvider#onCreate()}.
     *
     * @param context Application context forwarded to {@link DeeplinkServiceHub}.
     */
    public static void register(final android.content.Context context) {
        Log.d(TAG, "register()");
        DeeplinkServiceHub.init(context);

        JsbBridgeWrapper.getInstance().addScriptEventListener(
                CHANNEL,
                new JsbBridgeWrapper.OnScriptEventListener() {
                    @Override
                    public void onScriptEvent(String arg) {
                        handleIncoming(arg != null ? arg : "");
                    }
                });

        Log.d(TAG, "listener registered on channel \"" + CHANNEL + "\"");
    }

    // -------------------------------------------------------------------------
    // Incoming dispatch
    // -------------------------------------------------------------------------

    private static void handleIncoming(String raw) {
        final int id;
        final String method;
        final JSONObject args;

        try {
            JSONObject envelope = new JSONObject(raw);
            id     = envelope.getInt("id");
            method = envelope.getString("method");
            JSONObject argsObj = envelope.optJSONObject("args");
            args = argsObj != null ? argsObj : new JSONObject();
        } catch (JSONException e) {
            Log.e(TAG, "parse error on incoming message: " + raw, e);
            respondErr(0, "E_DEVELOPER_ERROR", "Malformed envelope: " + e.getMessage());
            return;
        }

        Log.d(TAG, "dispatch id=" + id + " method=" + method);
        DeeplinkServiceHub.dispatch(id, method, args);
    }

    // -------------------------------------------------------------------------
    // Outbound helpers — called from DeeplinkServiceHub
    // -------------------------------------------------------------------------

    /**
     * Send a successful response for request {@code id}.
     *
     * @param id   Request identifier from the JS envelope.
     * @param data Response payload, or null for empty-data responses.
     */
    public static void respondOk(final int id, final JSONObject data) {
        try {
            final JSONObject payload = new JSONObject();
            payload.put("kind",    "response");
            payload.put("id",      id);
            payload.put("success", true);
            payload.put("data",    data != null ? data : JSONObject.NULL);
            sendToScript(payload.toString());
        } catch (JSONException e) {
            Log.e(TAG, "respondOk: JSON build failed", e);
        }
    }

    /**
     * Send an error response for request {@code id}.
     *
     * @param id      Request identifier from the JS envelope.
     * @param code    Error code string (e.g. {@code "E_NOT_SUPPORTED"}).
     * @param message Human-readable description.
     */
    public static void respondErr(final int id, final String code, final String message) {
        try {
            JSONObject error = new JSONObject();
            error.put("code",    code);
            error.put("message", message);

            final JSONObject payload = new JSONObject();
            payload.put("kind",    "response");
            payload.put("id",      id);
            payload.put("success", false);
            payload.put("error",   error);
            sendToScript(payload.toString());
        } catch (JSONException e) {
            Log.e(TAG, "respondErr: JSON build failed", e);
        }
    }

    /**
     * Emit a push event (not a response to a request) to the JS layer.
     *
     * @param name    Event name, e.g. {@code "deeplinkReceived"}.
     * @param payload Event-specific data.
     */
    public static void emitEvent(final String name, final JSONObject payload) {
        try {
            final JSONObject envelope = new JSONObject();
            envelope.put("kind",    "event");
            envelope.put("name",    name);
            envelope.put("payload", payload != null ? payload : JSONObject.NULL);
            sendToScript(envelope.toString());
        } catch (JSONException e) {
            Log.e(TAG, "emitEvent: JSON build failed", e);
        }
    }

    // -------------------------------------------------------------------------
    // Transport
    // -------------------------------------------------------------------------

    private static void sendToScript(final String json) {
        CocosHelper.runOnGameThread(new Runnable() {
            @Override
            public void run() {
                JsbBridgeWrapper.getInstance().dispatchEventToScript(CHANNEL, json);
            }
        });
    }
}
