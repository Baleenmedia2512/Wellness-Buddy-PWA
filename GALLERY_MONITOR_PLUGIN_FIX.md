# Gallery Monitor Plugin Fix - October 14, 2025

## Problem
The GalleryMonitor custom Capacitor plugin was showing the error:
```
Error: "GalleryMonitor.setCurrentUser()" is not implemented on android
Error: "GalleryMonitor.checkGallery()" is not implemented on android
```

Additionally:
- Gemini API was using an outdated model that returned 404 errors
- JSON parsing errors when Gemini API failed
- Database save operations crashing on invalid API responses

## Root Causes

### 1. Plugin Registration Timing
The plugin was being registered **after** `super.onCreate()` in MainActivity, which meant Capacitor's bridge was already initialized without knowledge of the plugin.

### 2. Gemini API Model
Using `gemini-1.5-flash` with the `/v1/` endpoint, which is deprecated and returned 404 errors.

### 3. Error Handling
Code was attempting to parse error strings as JSON, causing JSONException crashes.

## Solutions Implemented

### 1. Fixed Plugin Registration Order
**File:** `frontend/android/app/src/main/java/com/wellnessbuddy/app/MainActivity.java`

```java
public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // ✅ Register plugin BEFORE super.onCreate()
        registerPlugin(GalleryMonitorPlugin.class);
        
        super.onCreate(savedInstanceState);
        
        android.util.Log.d("MainActivity", "✅ GalleryMonitorPlugin registered in MainActivity");
        // ... rest of onCreate
    }
}
```

**Key Change:** Moved `registerPlugin()` to execute **before** `super.onCreate()`.

### 2. Updated Gemini API to Flash 2.0
**File:** `frontend/android/app/src/main/java/com/wellnessbuddy/app/services/GeminiApiClient.java`

```java
// OLD (returned 404):
private static final String GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent";

// NEW (working):
private static final String GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";
```

**Key Changes:**
- Changed from `v1` to `v1beta` endpoint
- Updated model from `gemini-1.5-flash` to `gemini-2.0-flash-exp`

### 3. Added JSON Validation and Error Handling

#### GalleryMonitorService.java
```java
private void showAnalysisNotification(String imagePath, String result) {
    // ✅ Check if result is valid JSON before parsing
    if (result == null || result.startsWith("Analysis failed") || 
        result.startsWith("Error:") || result.equals("No result")) {
        Log.d(TAG, "Skipping notification for non-JSON result: " + result);
        return;
    }
    
    try {
        JSONObject obj = new JSONObject(result);
        // ... parse and show notification
    } catch (Exception e) {
        Log.e(TAG, "Error parsing Gemini result for notification", e);
        Log.d(TAG, "Result that failed to parse: " + result);
        return;
    }
    // ...
}
```

#### DatabaseSyncClient.java
```java
public boolean saveAnalysis(String userId, String imagePath, String analysisResult, 
                          long timestamp, String deviceInfo, String imageBase64) {
    try {
        Log.d(TAG, "Saving analysis to database for user: " + userId);
        
        // ✅ Check if analysisResult is valid JSON before processing
        if (analysisResult == null || analysisResult.startsWith("Analysis failed") || 
            analysisResult.startsWith("Error:") || analysisResult.equals("No result")) {
            Log.d(TAG, "❌ Skipping database save for non-JSON result: " + analysisResult);
            return false;
        }

        JSONObject requestBody = new JSONObject();
        requestBody.put("userId", userId);
        requestBody.put("imagePath", imagePath);
        
        // ✅ Safely parse the analysisResult
        try {
            requestBody.put("analysisResult", new JSONObject(analysisResult));
        } catch (JSONException e) {
            Log.e(TAG, "❌ Invalid JSON in analysisResult, skipping save: " + analysisResult);
            return false;
        }
        // ... rest of method
    }
}
```

**Added import:**
```java
import org.json.JSONException;
```

### 4. Simplified Capacitor Config
**File:** `frontend/capacitor.config.js`

```javascript
plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '610941252952-u9h8srgfr879aucl4sbc8h3f6i68cq7n.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    },
    GalleryMonitor: {} // ✅ Simplified - let Capacitor auto-discover
}
```

### 5. Enhanced JavaScript Plugin Initialization
**File:** `frontend/src/plugins/galleryMonitorPlugin.js`

- Removed the echo test from initialization (was causing unnecessary failures)
- Added platform check before initialization
- Improved error handling with bypass option for retry logic

## Testing Checklist

- [x] App builds successfully without errors
- [x] GalleryMonitor plugin is recognized by Capacitor
- [x] `setCurrentUser()` method works
- [x] `checkGallery()` method works
- [x] Gemini API uses correct model endpoint
- [x] Invalid API responses don't crash the app
- [x] Database saves skip invalid analysis results
- [ ] User authentication flows work correctly
- [ ] Background service persists user settings
- [ ] Image analysis completes successfully with new Gemini model

## Files Modified

1. `frontend/android/app/src/main/java/com/wellnessbuddy/app/MainActivity.java`
2. `frontend/android/app/src/main/java/com/wellnessbuddy/app/services/GeminiApiClient.java`
3. `frontend/android/app/src/main/java/com/wellnessbuddy/app/services/GalleryMonitorService.java`
4. `frontend/android/app/src/main/java/com/wellnessbuddy/app/services/DatabaseSyncClient.java`
5. `frontend/capacitor.config.js`
6. `frontend/src/plugins/galleryMonitorPlugin.js`

## Build Commands

```bash
# Full rebuild
cd frontend
npm run android:fullbuild

# Or just Android
cd frontend/android
.\gradlew.bat clean assembleDebug installDebug
```

## Next Steps

1. Test the app with actual user authentication
2. Verify background service receives user credentials
3. Test image capture and Gemini analysis
4. Monitor database saves for successful storage
5. Test app restart and service persistence

## Notes

- The plugin registration order is **critical** for Capacitor - always register custom plugins before `super.onCreate()`
- Gemini 2.0 Flash Exp requires the `/v1beta/` endpoint
- Error responses from external APIs should always be validated before parsing as JSON
- The plugin works even without explicit configuration in capacitor.config.js thanks to the `@CapacitorPlugin` annotation
