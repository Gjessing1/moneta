package io.gjessing.moneta;

import android.net.Uri;
import java.util.HashSet;
import java.util.Set;

/** Keep the selected server and SSO redirects in the WebView. */
final class MonetaNavigation {
    private final Uri serverOrigin;
    private final Set<String> authenticationOrigins = new HashSet<>();

    MonetaNavigation(String serverUrl) {
        serverOrigin = Uri.parse(serverUrl);
    }

    boolean shouldAllow(Uri target) {
        if (sameOrigin(target, serverOrigin)) return true;
        if (!"https".equalsIgnoreCase(target.getScheme())) return false;
        for (String name : new String[] { "redirect_uri", "redirect", "return_url", "returnUrl", "continue" }) {
            String value = target.getQueryParameter(name);
            if (value == null) continue;
            Uri returnUrl = Uri.parse(value);
            if (sameOrigin(returnUrl, serverOrigin) || authenticationOrigins.contains(origin(returnUrl))) {
                authenticationOrigins.add(origin(target));
                return true;
            }
        }
        return authenticationOrigins.contains(origin(target));
    }

    private static boolean sameOrigin(Uri left, Uri right) {
        return left.getScheme() != null && left.getScheme().equalsIgnoreCase(right.getScheme()) &&
            left.getHost() != null && left.getHost().equalsIgnoreCase(right.getHost()) &&
            port(left) == port(right);
    }

    private static int port(Uri uri) {
        return uri.getPort() >= 0 ? uri.getPort() : 443;
    }

    private static String origin(Uri uri) {
        return uri.getScheme() + "://" + uri.getEncodedAuthority();
    }
}
