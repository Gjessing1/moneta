package io.gjessing.moneta;

import android.app.DownloadManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.text.InputType;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.widget.EditText;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import android.widget.TextView;
import android.widget.LinearLayout;
import android.view.ViewGroup;
import androidx.appcompat.app.AlertDialog;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;

public class MainActivity extends BridgeActivity {
    private static final Pattern UTF8_FILENAME = Pattern.compile("filename\\*=UTF-8''([^;]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern QUOTED_FILENAME = Pattern.compile("filename=\"([^\"]+)\"", Pattern.CASE_INSENSITIVE);
    private boolean setupDialogVisible;
    private boolean connectionDialogVisible;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        String serverUrl = MonetaPreferences.getServerUrl(this);
        boolean debug = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        CapConfig.Builder builder = new CapConfig.Builder(this)
            .setAppendedUserAgentString("MonetaAndroid/1")
            .setLoggingEnabled(debug)
            .setWebContentsDebuggingEnabled(debug)
            .setResolveServiceWorkerRequests(false)
            .setInitialFocus(true);
        if (serverUrl != null) builder.setServerUrl(serverUrl);
        config = builder.create();
        registerPlugin(MonetaNativePlugin.class);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new MonetaBackNavigation(this));
        if (bridge != null && serverUrl != null) {
            bridge.setWebViewClient(new MonetaWebViewClient(bridge, this));
            bridge.getWebView().setDownloadListener(this::download);
        } else if (bridge != null) {
            bridge.getWebView().post(() -> showServerSetup(false));
        }
        if (bridge != null && WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHENTICATION)) {
            WebSettingsCompat.setWebAuthenticationSupport(
                bridge.getWebView().getSettings(),
                WebSettingsCompat.WEB_AUTHENTICATION_SUPPORT_FOR_BROWSER
            );
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        CookieManager.getInstance().flush();
    }

    private void download(String url, String userAgent, String disposition, String mime, long size) {
        String serverUrl = MonetaPreferences.getServerUrl(this);
        if (serverUrl == null || !url.startsWith(serverUrl + "/")) return;
        String name = downloadName(url, disposition, mime);
        DownloadManager.Request request = new DownloadManager.Request(android.net.Uri.parse(url));
        request.setMimeType(mime);
        request.setTitle(name);
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        // Without a destination the file lands in a system cache the user can't find.
        // Public Downloads needs no permission from Android 10; before that, the
        // app's own folder still opens from the completion notification.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
        } else {
            request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, name);
        }
        String cookies = CookieManager.getInstance().getCookie(url);
        if (cookies != null) request.addRequestHeader("Cookie", cookies);
        if (userAgent != null) request.addRequestHeader("User-Agent", userAgent);
        ((DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(request);
    }

    // Originals are served inline so the browser can show them, and Android only
    // reads the name from an attachment disposition, so take it from either.
    private static String downloadName(String url, String disposition, String mime) {
        String name = null;
        if (disposition != null) {
            Matcher utf8 = UTF8_FILENAME.matcher(disposition);
            Matcher quoted = QUOTED_FILENAME.matcher(disposition);
            try {
                if (utf8.find()) name = URLDecoder.decode(utf8.group(1).trim(), StandardCharsets.UTF_8.name());
            } catch (Exception ignored) {
                name = null;
            }
            if (name == null && quoted.find()) name = quoted.group(1);
        }
        if (name != null) name = name.replaceAll("[/\\\\\\x00-\\x1f]", "_").trim();
        if (name == null || name.isEmpty() || name.equals(".") || name.equals("..")) {
            return URLUtil.guessFileName(url, disposition, mime);
        }
        return name;
    }

    void showConnectionError() {
        if (connectionDialogVisible || isFinishing()) return;
        connectionDialogVisible = true;
        runOnUiThread(() -> new AlertDialog.Builder(this)
            .setTitle(R.string.server_unavailable_title)
            .setMessage(getString(R.string.server_unavailable_message, MonetaPreferences.getServerUrl(this)))
            .setPositiveButton(R.string.retry, (dialog, which) -> {
                connectionDialogVisible = false;
                bridge.getWebView().reload();
            })
            .setNegativeButton(R.string.change_server, (dialog, which) -> {
                connectionDialogVisible = false;
                showServerSetup(true);
            })
            .setOnCancelListener(dialog -> connectionDialogVisible = false)
            .show());
    }

    private void showServerSetup(boolean cancelable) {
        if (setupDialogVisible || isFinishing()) return;
        setupDialogVisible = true;
        int padding = Math.round(8 * getResources().getDisplayMetrics().density);
        LinearLayout fields = new LinearLayout(this);
        fields.setOrientation(LinearLayout.VERTICAL);
        fields.setPadding(padding, 0, padding, 0);

        EditText input = new EditText(this);
        input.setHint("https://moneta.gjessing.io");
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        String current = MonetaPreferences.getServerUrl(this);
        input.setText(current == null ? "https://moneta.gjessing.io" : current);
        input.setSelection(input.length());
        fields.addView(input, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView error = new TextView(this);
        error.setTextColor(0xffb3261e);
        fields.addView(error, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle(R.string.server_setup_title)
            .setMessage(R.string.server_setup_help)
            .setView(fields)
            .setPositiveButton(R.string.connect, null)
            .setCancelable(cancelable)
            .create();
        dialog.setOnCancelListener(value -> setupDialogVisible = false);
        dialog.setOnDismissListener(value -> setupDialogVisible = false);
        dialog.setOnShowListener(value -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(button -> {
            String normalized = MonetaPreferences.normalizeServerUrl(this, input.getText().toString());
            if (normalized == null) {
                error.setText(R.string.server_url_error);
                return;
            }
            MonetaPreferences.setServerUrl(this, normalized);
            dialog.dismiss();
            recreate();
        }));
        dialog.show();
    }
}
