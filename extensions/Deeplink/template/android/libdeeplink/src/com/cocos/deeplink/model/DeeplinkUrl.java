package com.cocos.deeplink.model;

import android.net.Uri;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Value object that parses an Android {@link Uri} into the wire-protocol
 * DeeplinkUrl JSON shape consumed by the JS layer.
 *
 * <p>Field names are camelCase (matching the Cocos bridge protocol).
 * Fields are omitted from the JSON object when absent or empty, except
 * {@code url} which is always present when the Uri is non-null.</p>
 *
 * <p>Port from {@code org.godotengine.plugin.deeplink.DeeplinkUrl} with:</p>
 * <ul>
 *   <li>snake_case property names → camelCase</li>
 *   <li>{@code Dictionary} (Godot) → {@link JSONObject} (org.json)</li>
 *   <li>Added {@code url} field (full URI string — absent in the original)</li>
 *   <li>Streams replaced with manual loops for Java 7/8 compat</li>
 * </ul>
 */
public class DeeplinkUrl {

    private static final String TAG = "cocos::DeeplinkUrl";

    /** Full URI string. Always included when the source Uri is non-null. */
    private static final String KEY_URL             = "url";
    private static final String KEY_SCHEME          = "scheme";
    private static final String KEY_USER            = "user";
    private static final String KEY_PASSWORD        = "password";
    private static final String KEY_HOST            = "host";
    private static final String KEY_PORT            = "port";
    private static final String KEY_PATH            = "path";
    private static final String KEY_PATH_EXTENSION  = "pathExtension";
    private static final String KEY_PATH_COMPONENTS = "pathComponents";
    private static final String KEY_QUERY           = "query";
    private static final String KEY_FRAGMENT        = "fragment";

    private final JSONObject _data;

    /**
     * Parse {@code uri} into the bridge JSON representation.
     *
     * @param uri Non-null URI received from an Android intent.
     */
    public DeeplinkUrl(Uri uri) {
        _data = new JSONObject();

        try {
            // url — full string (added in this Cocos port)
            String uriString = uri.toString();
            if (uriString != null && !uriString.isEmpty()) {
                _data.put(KEY_URL, uriString);
            }

            // scheme
            String scheme = uri.getScheme();
            if (scheme != null && !scheme.isEmpty()) {
                _data.put(KEY_SCHEME, scheme);
            }

            // user / password
            String userInfo = uri.getUserInfo();
            if (userInfo != null && !userInfo.isEmpty()) {
                String[] parts = userInfo.split(":", 2);
                if (!parts[0].isEmpty()) {
                    _data.put(KEY_USER, parts[0]);
                }
                if (parts.length > 1 && !parts[1].isEmpty()) {
                    _data.put(KEY_PASSWORD, parts[1]);
                }
            }

            // host
            String host = uri.getHost();
            if (host != null && !host.isEmpty()) {
                _data.put(KEY_HOST, host);
            }

            // port
            int port = uri.getPort();
            if (port >= 0) {
                _data.put(KEY_PORT, port);
            }

            // path
            String path = uri.getPath();
            if (path != null && !path.isEmpty()) {
                _data.put(KEY_PATH, path);

                // pathExtension — text after the last dot, if the dot follows the last slash
                int lastDot   = path.lastIndexOf('.');
                int lastSlash = path.lastIndexOf('/');
                if (lastDot > lastSlash && lastDot + 1 < path.length()) {
                    _data.put(KEY_PATH_EXTENSION, path.substring(lastDot + 1));
                }

                // pathComponents — non-empty segments split by '/'
                String[] segments = path.split("/");
                JSONArray components = new JSONArray();
                for (String seg : segments) {
                    if (!seg.isEmpty()) {
                        components.put(seg);
                    }
                }
                if (components.length() > 0) {
                    _data.put(KEY_PATH_COMPONENTS, components);
                }
            }

            // query
            String query = uri.getQuery();
            if (query != null && !query.isEmpty()) {
                _data.put(KEY_QUERY, query);
            }

            // fragment
            String fragment = uri.getFragment();
            if (fragment != null && !fragment.isEmpty()) {
                _data.put(KEY_FRAGMENT, fragment);
            }

        } catch (JSONException e) {
            Log.e(TAG, "Failed to build DeeplinkUrl JSON from uri=" + uri, e);
        }
    }

    /**
     * Return the JSON representation suitable for the Cocos bridge wire protocol.
     *
     * @return Parsed data object; may be empty if the source URI was malformed.
     */
    public JSONObject toJson() {
        return _data;
    }
}
