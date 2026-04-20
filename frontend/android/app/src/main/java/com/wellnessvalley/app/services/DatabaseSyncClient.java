package com.wellnessvalley.app.services;

import android.content.Context;
import android.util.Base64;
import android.util.Log;
import okhttp3.*;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.concurrent.TimeUnit;

public class DatabaseSyncClient {
    private static final String TAG = "DatabaseSyncClient";
    private final String apiBaseUrl;
    private final OkHttpClient client;
    private final Context context;
    
    public DatabaseSyncClient(String apiBaseUrl) {
        this(apiBaseUrl, null);
    }
    
    public DatabaseSyncClient(String apiBaseUrl, Context context) {
        this.apiBaseUrl = apiBaseUrl;
        this.context = context;
        this.client = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build();
    }
    
    // Method to lookup database UserId from Firebase email
    public String lookupDatabaseUserId(String email, String firebaseUid) {
        try {
            Log.d(TAG, "Looking up database UserId for email: " + email);
            
            JSONObject requestBody = new JSONObject();
            if (email != null && !email.isEmpty()) {
                requestBody.put("email", email);
            }
            Request request = new Request.Builder()
                .url(apiBaseUrl + "/api/lookup-user-id")
                .post(RequestBody.create(
                    requestBody.toString(), 
                    MediaType.parse("application/json")
                ))
                .addHeader("Content-Type", "application/json")
                .addHeader("User-Agent", "WellnessValley-Android/1.0")
                .build();
                
            Response response = client.newCall(request).execute();
            String responseBody = response.body() != null ? response.body().string() : "";
            
            if (response.isSuccessful()) {
                JSONObject responseJson = new JSONObject(responseBody);
                if (responseJson.getBoolean("success")) {
                    String dbUserId = responseJson.getString("userId");
                    Log.d(TAG, "✅ Database UserId found: " + dbUserId);
                    
                    // Cache the successful lookup result in SharedPreferences
                    if (context != null) {
                        android.content.SharedPreferences prefs = context.getSharedPreferences("WellnessValley", Context.MODE_PRIVATE);
                        prefs.edit().putString("cached_db_user_id", dbUserId).apply();
                        Log.d(TAG, "✅ Database UserId cached locally: " + dbUserId);
                    }
                    
                    response.close();
                    return dbUserId;
                } else {
                    Log.w(TAG, "❌ User lookup failed: " + responseJson.optString("message"));
                }
            } else {
                Log.e(TAG, "❌ User lookup HTTP error: " + response.code() + " - " + responseBody);
            }
            
            response.close();
            return null;
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error looking up database UserId", e);
            return null;
        }
    }
    
    // Overload for backward compatibility (no imageBase64)
    public boolean saveAnalysis(String userId, String imagePath, String analysisResult, long timestamp) {
        return saveAnalysis(userId, imagePath, analysisResult, timestamp, "Android Background Service", null);
    }

    public boolean saveAnalysis(String userId, String imagePath, String analysisResult, long timestamp, String deviceInfo) {
        return saveAnalysis(userId, imagePath, analysisResult, timestamp, deviceInfo, null);
    }

    // New method: accepts imageBase64 and sends it to backend
    public boolean saveAnalysis(String userId, String imagePath, String analysisResult, long timestamp, String deviceInfo, String imageBase64) {
        try {
            Log.d(TAG, "Saving analysis to database for user: " + userId);
            
            // Check if analysisResult is valid JSON before processing
            if (analysisResult == null || analysisResult.startsWith("Analysis failed") || analysisResult.startsWith("Error:") || analysisResult.equals("No result")) {
                Log.d(TAG, "❌ Skipping database save for non-JSON result: " + analysisResult);
                return false;
            }

            // ✅ Skip save if Gemini detected no food (empty foods array)
            try {
                JSONObject parsed = new JSONObject(analysisResult);
                JSONArray foods = parsed.optJSONArray("foods");
                if (foods == null || foods.length() == 0) {
                    Log.d(TAG, "⏭️ Skipping database save — Gemini detected no food in this image");
                    return false;
                }
            } catch (JSONException e) {
                Log.e(TAG, "❌ Could not parse analysisResult to check foods array, skipping save: " + analysisResult);
                return false;
            }

            JSONObject requestBody = new JSONObject();
            requestBody.put("userId", userId);
            requestBody.put("imagePath", imagePath);
            
            // Safely parse the analysisResult
            try {
                requestBody.put("analysisResult", new JSONObject(analysisResult));
            } catch (JSONException e) {
                Log.e(TAG, "❌ Invalid JSON in analysisResult, skipping save: " + analysisResult);
                return false;
            }
            
            requestBody.put("timestamp", timestamp);
            requestBody.put("deviceInfo", deviceInfo);
            if (imageBase64 != null && !imageBase64.isEmpty()) {
                requestBody.put("ImageBase64", imageBase64);
            }

            Request request = new Request.Builder()
                .url(apiBaseUrl + "/api/save-background-analysis")
                .post(RequestBody.create(
                    requestBody.toString(),
                    MediaType.parse("application/json")
                ))
                .addHeader("Content-Type", "application/json")
                .addHeader("User-Agent", "WellnessValley-Android/1.0")
                .build();

            Response response = client.newCall(request).execute();
            String responseBody = response.body() != null ? response.body().string() : "";
            boolean success = response.isSuccessful();

            if (success) {
                Log.d(TAG, "✅ Analysis saved to MariaDB successfully: " + responseBody);
            } else {
                Log.e(TAG, "❌ MariaDB save failed: " + response.code() + " - " + responseBody);
            }

            response.close();
            return success;

        } catch (Exception e) {
            Log.e(TAG, "❌ Error saving analysis to MariaDB", e);
            return false;
        }
    }
    
    // Save daily step count to the backend (called by GalleryMonitorService step tracker)
    public boolean saveDailySteps(String userId, String activityDate, int steps, double calories) {
        return saveDailySteps(userId, activityDate, steps, calories, false);
    }

    // forceWrite=true bypasses the Math.max guard so a correction can lower an inflated DB value.
    public boolean saveDailySteps(String userId, String activityDate, int steps, double calories, boolean forceWrite) {
        try {
            JSONObject body = new JSONObject();
            body.put("userId", userId);
            body.put("activityDate", activityDate);
            body.put("steps", steps);
            body.put("activityType", "walking");
            body.put("caloriesBurned", calories);
            if (forceWrite) {
                body.put("forceWrite", true);
            }

            Request request = new Request.Builder()
                .url(apiBaseUrl + "/api/save-daily-activity")
                .post(RequestBody.create(
                    body.toString(),
                    MediaType.parse("application/json")
                ))
                .addHeader("Content-Type", "application/json")
                .addHeader("User-Agent", "WellnessValley-Android/1.0")
                .build();

            Response response = client.newCall(request).execute();
            boolean success = response.isSuccessful();
            response.close();
            return success;
        } catch (Exception e) {
            Log.e(TAG, "❌ saveDailySteps failed", e);
            return false;
        }
    }

    // Save daily screen time to the backend (called by GalleryMonitorService UsageStats tracker)
    public boolean saveScreenTime(String userId, String date, long totalScreenTimeSeconds) {
        try {
            JSONObject body = new JSONObject();
            body.put("userId", userId);
            body.put("date", date);
            body.put("totalScreenTimeSeconds", totalScreenTimeSeconds);

            Request request = new Request.Builder()
                .url(apiBaseUrl + "/api/save-screen-time")
                .post(RequestBody.create(
                    body.toString(),
                    MediaType.parse("application/json")
                ))
                .addHeader("Content-Type", "application/json")
                .addHeader("User-Agent", "WellnessValley-Android/1.0")
                .build();

            Response response = client.newCall(request).execute();
            boolean success = response.isSuccessful();
            response.close();
            return success;
        } catch (Exception e) {
            Log.e(TAG, "❌ saveScreenTime failed", e);
            return false;
        }
    }

    // Health check method to test database connectivity
    public boolean testConnection() {        try {
            Request request = new Request.Builder()
                .url(apiBaseUrl + "/api/get-background-analysis?userId=test&limit=1")
                .get()
                .addHeader("User-Agent", "WellnessValley-Android/1.0")
                .build();
                
            Response response = client.newCall(request).execute();
            boolean success = response.isSuccessful();
            response.close();
            
            Log.d(TAG, success ? "✅ Database connection test passed" : "❌ Database connection test failed");
            return success;
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Database connection test error", e);
            return false;
        }
    }
    
    /** Max dimension for images encoded for DB upload — keeps memory usage low. */
    private static final int MAX_IMAGE_DIMENSION = 1024;

    /**
     * Downsample + JPEG-compress the image before base64-encoding.
     * A raw 10 MB camera photo would need ~30 MB heap (bytes + base64 + JSON).
     * After resize to 1024px and 80% JPEG quality the payload is typically < 200 KB.
     */
    public static String encodeImageToBase64(String imagePath) {
        try {
            // 1. Decode bounds only
            android.graphics.BitmapFactory.Options opts = new android.graphics.BitmapFactory.Options();
            opts.inJustDecodeBounds = true;
            android.graphics.BitmapFactory.decodeFile(imagePath, opts);

            // 2. Calculate down-sample factor
            int w = opts.outWidth;
            int h = opts.outHeight;
            int inSampleSize = 1;
            while ((w / inSampleSize) > MAX_IMAGE_DIMENSION || (h / inSampleSize) > MAX_IMAGE_DIMENSION) {
                inSampleSize *= 2;
            }

            // 3. Decode with down-sampling
            opts.inSampleSize = inSampleSize;
            opts.inJustDecodeBounds = false;
            android.graphics.Bitmap bmp = android.graphics.BitmapFactory.decodeFile(imagePath, opts);
            if (bmp == null) {
                Log.e("DatabaseSyncClient", "Failed to decode image: " + imagePath);
                return null;
            }

            // 4. Compress to JPEG bytes
            java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
            bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 80, bos);
            bmp.recycle();
            byte[] bytes = bos.toByteArray();

            return "data:image/jpeg;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP);
        } catch (Exception e) {
            Log.e("DatabaseSyncClient", "Failed to encode image to base64", e);
            return null;
        }
    }
}
