package com.wellnessvalley.app.services;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class RetryQueue {
    private static final String TAG = "RetryQueue";
    private static final String PREFS_NAME = "AnalysisRetryQueue";
    private static final String KEY_RETRY_QUEUE = "retryQueue";
    private static final int MAX_RETRIES = 3;
    
    private final SharedPreferences prefs;
    private final DatabaseSyncClient databaseClient;
    
    public RetryQueue(Context context, DatabaseSyncClient databaseClient) {
        this.prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        this.databaseClient = databaseClient;
    }
    
    public void add(String userId, String imagePath, String analysisResult, long timestamp) {
        try {
            JSONArray queue = getQueue();
            JSONObject item = new JSONObject();
            item.put("userId", userId);
            item.put("imagePath", imagePath);
            item.put("analysisResult", analysisResult);
            item.put("timestamp", timestamp);
            item.put("retryCount", 0);
            item.put("addedAt", System.currentTimeMillis());
            
            queue.put(item);
            saveQueue(queue);
            
            Log.d(TAG, "Added item to retry queue. Queue size: " + queue.length());
        } catch (Exception e) {
            Log.e(TAG, "Failed to add item to retry queue", e);
        }
    }
    
    public void processRetries() {
        try {
            JSONArray queue = getQueue();
            JSONArray newQueue = new JSONArray();
            int processedCount = 0;
            int successCount = 0;
            int failedCount = 0;
            int discardedCount = 0;
            
            Log.d(TAG, "Processing retry queue with " + queue.length() + " items");
            
            for (int i = 0; i < queue.length(); i++) {
                JSONObject item = queue.getJSONObject(i);
                int retryCount = item.getInt("retryCount");
                processedCount++;
                
                if (retryCount < MAX_RETRIES) {
                    boolean success = databaseClient.saveAnalysis(
                        item.getString("userId"),
                        item.getString("imagePath"),
                        item.getString("analysisResult"),
                        item.getLong("timestamp"),
                        "Android Background Service (Retry " + (retryCount + 1) + ")"
                    );
                    
                    if (success) {
                        successCount++;
                        Log.d(TAG, "✅ Retry successful for item " + (i + 1));
                    } else {
                        failedCount++;
                        item.put("retryCount", retryCount + 1);
                        item.put("lastRetryAt", System.currentTimeMillis());
                        newQueue.put(item);
                        Log.w(TAG, "❌ Retry failed for item " + (i + 1) + ", retry count: " + (retryCount + 1));
                    }
                } else {
                    discardedCount++;
                    Log.w(TAG, "🗑️ Max retries reached for item " + (i + 1) + ", discarding");
                }
            }
            
            saveQueue(newQueue);
            
            Log.i(TAG, String.format(
                "Retry processing complete: %d processed, %d successful, %d failed, %d discarded, %d remaining in queue",
                processedCount, successCount, failedCount, discardedCount, newQueue.length()
            ));
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to process retry queue", e);
        }
    }
    
    private JSONArray getQueue() {
        try {
            String queueJson = prefs.getString(KEY_RETRY_QUEUE, "[]");
            return new JSONArray(queueJson);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get retry queue, returning empty array", e);
            return new JSONArray();
        }
    }
    
    private void saveQueue(JSONArray queue) {
        try {
            prefs.edit().putString(KEY_RETRY_QUEUE, queue.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Failed to save retry queue", e);
        }
    }
    
    public int getQueueSize() {
        return getQueue().length();
    }
    
    public void clear() {
        prefs.edit().remove(KEY_RETRY_QUEUE).apply();
        Log.d(TAG, "Retry queue cleared");
    }
    
    // Get queue stats for debugging
    public String getQueueStats() {
        try {
            JSONArray queue = getQueue();
            if (queue.length() == 0) {
                return "Retry queue is empty";
            }
            
            int highRetry = 0;
            long oldestItem = System.currentTimeMillis();
            
            for (int i = 0; i < queue.length(); i++) {
                JSONObject item = queue.getJSONObject(i);
                int retryCount = item.getInt("retryCount");
                long addedAt = item.optLong("addedAt", System.currentTimeMillis());
                
                if (retryCount >= 2) highRetry++;
                if (addedAt < oldestItem) oldestItem = addedAt;
            }
            
            long oldestAge = (System.currentTimeMillis() - oldestItem) / (1000 * 60); // minutes
            
            return String.format(
                "Queue: %d items, %d high-retry items, oldest: %d minutes ago",
                queue.length(), highRetry, oldestAge
            );
            
        } catch (Exception e) {
            return "Error getting queue stats: " + e.getMessage();
        }
    }
}
