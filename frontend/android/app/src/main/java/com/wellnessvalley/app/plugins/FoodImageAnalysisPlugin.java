package com.wellnessvalley.app.plugins;

import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;
import com.wellnessvalley.app.services.FoodImageQueue;
import android.content.Context;
import androidx.core.app.NotificationCompat;
import android.app.NotificationManager;

@CapacitorPlugin(name = "FoodImageAnalysis")
public class FoodImageAnalysisPlugin extends Plugin {
    public void analyzeImage(PluginCall call) {
        String imagePath = call.getString("imagePath");
        Log.d("FoodImageAnalysisPlugin", "Analyze image: " + imagePath);
        JSObject ret = new JSObject();
        ret.put("result", "pending");
        call.resolve(ret);
    }

    private FoodImageQueue foodImageQueue;
    @Override
    public void load() {
        super.load();
        foodImageQueue = new FoodImageQueue(getContext());
    }
    public void getQueuedImages(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("images", foodImageQueue.getQueue());
        call.resolve(ret);
    }

    public void markImageProcessed(PluginCall call) {
        String imagePath = call.getString("imagePath");
        foodImageQueue.remove(imagePath);
        JSObject ret = new JSObject();
        ret.put("status", "removed");
        call.resolve(ret);
    }

    public void notifyAnalysisResult(PluginCall call) {
        String imagePath = call.getString("imagePath");
        String result = call.getString("result");
        Log.d("FoodImageAnalysisPlugin", "Analysis result for " + imagePath + ": " + result);
        showAnalysisNotification(imagePath, result);
        JSObject ret = new JSObject();
        ret.put("status", "notified");
        call.resolve(ret);
    }

    private void showAnalysisNotification(String imagePath, String result) {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), "GalleryMonitorChannel")
                .setSmallIcon(android.R.drawable.ic_menu_camera)
                .setContentTitle("Food Analysis Complete")
                .setContentText("Result: " + result)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true);
        NotificationManager notificationManager = (NotificationManager) getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        notificationManager.notify((int) System.currentTimeMillis(), builder.build());
    }
}