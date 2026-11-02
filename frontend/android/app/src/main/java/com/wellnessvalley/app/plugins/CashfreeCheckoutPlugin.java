package com.wellnessvalley.app.plugins;

import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import com.cashfree.pg.api.CFPaymentGatewayService;
import com.cashfree.pg.core.api.CFSession;
import com.cashfree.pg.core.api.callback.CFCheckoutResponseCallback;
import com.cashfree.pg.core.api.exception.CFException;
import com.cashfree.pg.core.api.utils.CFErrorResponse;
import com.cashfree.pg.core.api.webcheckout.CFWebCheckoutPayment;
import com.cashfree.pg.core.api.webcheckout.CFWebCheckoutTheme;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Android-only Cashfree native checkout (card, UPI apps, net banking).
 * Web/iOS keep the existing JS modal.
 */
@CapacitorPlugin(name = "CashfreeCheckout")
public class CashfreeCheckoutPlugin extends Plugin implements CFCheckoutResponseCallback {
    private static final String TAG = "CashfreeCheckout";
    private PluginCall pendingCall;

    @Override
    public void load() {
        super.load();
        bindCheckoutCallback();
    }

    @PluginMethod
    public void startUpiIntent(PluginCall call) {
        String sessionId = call.getString("paymentSessionId");
        String orderId = call.getString("orderId");
        String mode = call.getString("mode", "sandbox");
        if (sessionId == null || sessionId.isEmpty() || orderId == null || orderId.isEmpty()) {
            call.unavailable("Payment could not start");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.unavailable("Payment could not start");
            return;
        }
        if (!isInstalledFromPlay()) {
            call.unavailable("Payment could not start");
            return;
        }
        call.setKeepAlive(true);
        pendingCall = call;
        activity.runOnUiThread(() -> openWebCheckout(activity, call, sessionId, orderId, mode));
    }

    private void openWebCheckout(
        Activity activity,
        PluginCall call,
        String sessionId,
        String orderId,
        String mode
    ) {
        try {
            bindCheckoutCallback();
            CFSession.Environment environment = "production".equalsIgnoreCase(mode)
                ? CFSession.Environment.PRODUCTION
                : CFSession.Environment.SANDBOX;
            CFSession session = new CFSession.CFSessionBuilder()
                .setEnvironment(environment)
                .setPaymentSessionID(sessionId)
                .setOrderId(orderId)
                .build();
            CFWebCheckoutTheme theme = new CFWebCheckoutTheme.CFWebCheckoutThemeBuilder()
                .setNavigationBarBackgroundColor("#16A34A")
                .setNavigationBarTextColor("#FFFFFF")
                .build();
            CFWebCheckoutPayment payment = new CFWebCheckoutPayment.CFWebCheckoutPaymentBuilder()
                .setSession(session)
                .setCFWebCheckoutUITheme(theme)
                .build();
            CFPaymentGatewayService.getInstance().doPayment(activity, payment);
        } catch (Exception exception) {
            Log.e(TAG, "Cashfree checkout could not open", exception);
            pendingCall = null;
            call.setKeepAlive(false);
            call.unavailable("Payment could not start");
        }
    }

    @Override
    public void onPaymentVerify(String orderID) {
        PluginCall call = takePendingCall();
        if (call == null) return;
        JSObject details = new JSObject();
        details.put("orderId", orderID);
        JSObject result = new JSObject();
        result.put("status", "verify");
        result.put("orderId", orderID);
        result.put("paymentDetails", details);
        call.resolve(result);
    }

    @Override
    public void onPaymentFailure(CFErrorResponse errorResponse, String orderID) {
        PluginCall call = takePendingCall();
        if (call == null) return;
        if (isCancelled(errorResponse)) {
            JSObject result = new JSObject();
            result.put("status", "cancelled");
            result.put("orderId", orderID);
            call.resolve(result);
            return;
        }
        String message = errorResponse != null ? errorResponse.getMessage() : null;
        if (isSideloadUpiBlock(message)) {
            call.reject("Google Pay needs the Play Store app. Try PhonePe or card.", "SIDELOAD_UPI");
            return;
        }
        call.reject(message != null && !message.trim().isEmpty() ? message : "Payment could not complete");
    }

    @Override
    protected void handleOnDestroy() {
        PluginCall call = takePendingCall();
        if (call != null) {
            JSObject result = new JSObject();
            result.put("status", "cancelled");
            call.resolve(result);
        }
        super.handleOnDestroy();
    }

    private void bindCheckoutCallback() {
        try {
            CFPaymentGatewayService.getInstance().setCheckoutCallback(this);
        } catch (CFException exception) {
            Log.e(TAG, "Cashfree callback not set", exception);
        }
    }

    private PluginCall takePendingCall() {
        PluginCall call = pendingCall;
        pendingCall = null;
        if (call != null) call.setKeepAlive(false);
        return call;
    }

    private boolean isInstalledFromPlay() {
        try {
            PackageManager pm = getContext().getPackageManager();
            String installer;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                installer = pm.getInstallSourceInfo(getContext().getPackageName()).getInstallingPackageName();
            } else {
                installer = pm.getInstallerPackageName(getContext().getPackageName());
            }
            return "com.android.vending".equals(installer);
        } catch (Exception exception) {
            return false;
        }
    }

    private static boolean isCancelled(CFErrorResponse errorResponse) {
        if (errorResponse == null) return false;
        String blob = (safe(errorResponse.getCode()) + " " + safe(errorResponse.getMessage())).toLowerCase();
        return blob.contains("cancel") || blob.contains("user_aborted") || blob.contains("dropped");
    }

    private static boolean isSideloadUpiBlock(String message) {
        String blob = safe(message).toLowerCase();
        return blob.contains("packageinstaller")
            || blob.contains("not a trusted source")
            || blob.contains("whitelisted app store");
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}
