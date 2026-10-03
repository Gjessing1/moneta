package io.gjessing.moneta;

import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.view.Window;
import android.net.Uri;
import android.webkit.CookieManager;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "MonetaNative")
public class MonetaNativePlugin extends Plugin {
    private MonetaNavigation navigation;
    private Integer systemBarsColor;

    @Override
    public void load() {
        String serverUrl = MonetaPreferences.getServerUrl(getContext());
        if (serverUrl != null) navigation = new MonetaNavigation(serverUrl);
    }

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        return navigation != null && navigation.shouldAllow(url) ? false : null;
    }

    /**
     * Paint the strips around an inset WebView in the page's background. They show
     * on Android 15+ when the WebView is older than 140 or the page lacks
     * viewport-fit=cover (the SSO login), and below Android 15 the bars themselves
     * are opaque. The web app sets the icon style through Capacitor's SystemBars
     * first, because that plugin resets the decor background on every change.
     */
    @PluginMethod
    public void setSystemBarsColor(PluginCall call) {
        String raw = call.getString("color");
        final int color;
        try {
            color = Color.parseColor(raw == null ? "" : raw.trim());
        } catch (IllegalArgumentException error) {
            call.reject("Expected an #rrggbb colour, got: " + raw);
            return;
        }
        systemBarsColor = color;
        getActivity().runOnUiThread(this::paintSystemBars);
        call.resolve();
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        // SystemBars re-applies its style on a configuration change (a device
        // night-mode flip), which resets the decor to the launch theme.
        paintSystemBars();
    }

    @SuppressWarnings("deprecation")
    private void paintSystemBars() {
        if (systemBarsColor == null || getActivity() == null) return;
        Window window = getActivity().getWindow();
        window.getDecorView().setBackgroundColor(systemBarsColor);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            window.setStatusBarColor(systemBarsColor);
            // Before Android 8.1 the navigation icons are always white.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) window.setNavigationBarColor(systemBarsColor);
        }
    }

    @PluginMethod
    public void openMaily(PluginCall call) {
        String raw = call.getString("url");
        Uri uri = raw == null ? null : Uri.parse(raw);
        if (uri == null || !"https".equals(uri.getScheme()) ||
            uri.getPathSegments().size() != 2 || !"m".equals(uri.getPathSegments().get(0)) ||
            !uri.getPathSegments().get(1).matches("[0-9a-fA-F-]{36}")) {
            call.reject("Invalid maily message URL");
            return;
        }
        try {
            Intent app = new Intent(Intent.ACTION_MAIN);
            app.setClassName("io.gjessing.maily", "io.gjessing.maily.MainActivity");
            app.putExtra("messageId", uri.getPathSegments().get(1));
            getActivity().startActivity(app);
            call.resolve();
        } catch (Exception noApp) {
            try {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri));
                call.resolve();
            } catch (Exception error) {
                call.reject("No app can open maily", error);
            }
        }
    }

    @PluginMethod
    public void shareFiles(PluginCall call) {
        JSONArray files = call.getArray("files");
        if (files == null || files.length() == 0 || files.length() > 20) {
            call.reject("Choose one to twenty originals to share");
            return;
        }
        String serverUrl = MonetaPreferences.getServerUrl(getContext());
        if (serverUrl == null) {
            call.reject("Connect to Moneta first");
            return;
        }
        new Thread(() -> {
            try {
                File shares = new File(getContext().getCacheDir(), "shares");
                pruneOldShares(shares);
                File directory = new File(shares, UUID.randomUUID().toString());
                if (!directory.mkdirs()) throw new Exception("Could not prepare shared files");
                ArrayList<Uri> uris = new ArrayList<>();
                String mime = "*/*";
                for (int i = 0; i < files.length(); i++) {
                    JSONObject entry = files.getJSONObject(i);
                    String rawUrl = entry.getString("url");
                    Uri url = Uri.parse(rawUrl);
                    Uri server = Uri.parse(serverUrl);
                    if (!server.getScheme().equalsIgnoreCase(url.getScheme()) ||
                        !server.getHost().equalsIgnoreCase(url.getHost()) ||
                        effectivePort(server) != effectivePort(url) ||
                        !url.getPath().matches("/api/documents/[0-9a-fA-F-]{36}/file/\\d+")) {
                        throw new Exception("Invalid original URL");
                    }
                    String name = entry.getString("name").replaceAll("[^a-zA-Z0-9._ -]", "_");
                    if (name.isBlank() || name.equals(".") || name.equals("..")) name = "original";
                    // A folder per file keeps the original name in the receiving app,
                    // even when two originals share one.
                    File slot = new File(directory, String.valueOf(i));
                    if (!slot.mkdirs()) throw new Exception("Could not prepare shared files");
                    File copy = new File(slot, name);
                    HttpURLConnection connection = (HttpURLConnection) new URL(rawUrl).openConnection();
                    connection.setInstanceFollowRedirects(false);
                    connection.setConnectTimeout(15_000);
                    connection.setReadTimeout(120_000);
                    String cookies = CookieManager.getInstance().getCookie(rawUrl);
                    if (cookies != null) connection.setRequestProperty("Cookie", cookies);
                    try {
                        if (connection.getResponseCode() != 200) throw new Exception("Original download failed");
                        try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(copy)) {
                            byte[] buffer = new byte[8192];
                            long count = 0;
                            int read;
                            while ((read = input.read(buffer)) != -1) {
                                count += read;
                                if (count > 50_000_000) throw new Exception("Original is too large to share");
                                output.write(buffer, 0, read);
                            }
                        }
                    } finally {
                        connection.disconnect();
                    }
                    uris.add(FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", copy));
                    String contentType = entry.getString("type");
                    if (i == 0) mime = contentType;
                    else if (!mime.equals(contentType)) mime = "*/*";
                }
                String shareType = mime;
                getActivity().runOnUiThread(() -> {
                    Intent intent = new Intent(uris.size() == 1 ? Intent.ACTION_SEND : Intent.ACTION_SEND_MULTIPLE);
                    intent.setType(shareType);
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    if (uris.size() == 1) intent.putExtra(Intent.EXTRA_STREAM, uris.get(0));
                    else intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
                    getActivity().startActivity(Intent.createChooser(intent, "Share original"));
                    call.resolve();
                });
            } catch (Exception error) {
                call.reject("Could not share the original", error);
            }
        }).start();
    }

    // The receiving app may still be reading a recent share, so only copies from
    // earlier days go.
    private static void pruneOldShares(File shares) {
        File[] entries = shares.listFiles();
        if (entries == null) return;
        long cutoff = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
        for (File entry : entries) {
            if (entry.lastModified() < cutoff) deleteTree(entry);
        }
    }

    private static void deleteTree(File file) {
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) deleteTree(child);
        }
        file.delete();
    }

    private static int effectivePort(Uri uri) {
        return uri.getPort() >= 0 ? uri.getPort() : 443;
    }
}
