package io.gjessing.moneta;

import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Bridge;

final class MonetaBackNavigation extends OnBackPressedCallback {
    private final MainActivity activity;
    private boolean awaitingPage;

    MonetaBackNavigation(MainActivity activity) {
        super(true);
        this.activity = activity;
    }

    @Override
    public void handleOnBackPressed() {
        Bridge bridge = activity.getBridge();
        if (bridge == null) {
            activity.finish();
            return;
        }
        if (awaitingPage) return;
        awaitingPage = true;
        WebView webView = bridge.getWebView();
        bridge.eval("window.monetaBack ? window.monetaBack() : null", value -> {
            awaitingPage = false;
            if ("true".equals(value)) return;
            if (!"false".equals(value) && webView.canGoBack()) webView.goBack();
            else activity.finish();
        });
    }
}
