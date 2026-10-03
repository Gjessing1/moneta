package io.gjessing.moneta;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import java.net.URI;

final class MonetaPreferences {
    private static final String PREFS = "moneta_native";
    private static final String SERVER_URL = "server_url";

    static String getServerUrl(Context context) {
        return normalizeServerUrl(context, context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(SERVER_URL, null));
    }

    static void setServerUrl(Context context, String url) {
        String normalized = normalizeServerUrl(context, url);
        if (normalized == null) throw new IllegalArgumentException("Invalid Moneta server URL");
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(SERVER_URL, normalized).apply();
    }

    static String normalizeServerUrl(Context context, String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            URI uri = new URI(raw.trim());
            String path = uri.getRawPath();
            boolean debug = (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
            boolean localDebug = debug && "http".equalsIgnoreCase(uri.getScheme()) &&
                ("10.0.2.2".equals(uri.getHost()) || "127.0.0.1".equals(uri.getHost()));
            if (!("https".equalsIgnoreCase(uri.getScheme()) || localDebug) || uri.getHost() == null ||
                uri.getUserInfo() != null || uri.getRawQuery() != null || uri.getRawFragment() != null ||
                (path != null && !path.isEmpty() && !"/".equals(path))) return null;
            return new URI(uri.getScheme().toLowerCase(), null, uri.getHost(), uri.getPort(), null, null, null).toASCIIString();
        } catch (Exception ignored) {
            return null;
        }
    }
}
