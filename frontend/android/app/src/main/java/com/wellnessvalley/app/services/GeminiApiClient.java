package com.wellnessvalley.app.services;

import android.util.Base64;
import android.util.Log;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class GeminiApiClient {
private static final String GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    private final String apiKey;
    private final OkHttpClient client;

    public GeminiApiClient(String apiKey) {
        this.apiKey = apiKey;
        this.client = new OkHttpClient.Builder()
            .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .build();
    }

    /** Max dimension (width or height) for images sent to Gemini — keeps memory usage low. */
    private static final int MAX_IMAGE_DIMENSION = 1024;

    public String analyzeImage(String imagePath) {
        try {
            byte[] imageBytes = readAndCompressImage(imagePath, MAX_IMAGE_DIMENSION);
            String base64Image = Base64.encodeToString(imageBytes, Base64.NO_WRAP);

            // Optimized prompt matching geminiService.js
            String prompt = "Analyze food image, return JSON. Quick, accurate estimates.\n\n" +
                    "RULES:\n" +
                    "1. Estimate portions by visual cues\n" +
                    "2. Use standard USDA values\n" +
                    "3. Liquids: use ml/L; Solids: use grams\n\n" +
                    "FORMAT:\n" +
                    "{\n" +
                    "  \"foods\": [{\n" +
                    "    \"name\": \"food name\",\n" +
                    "    \"portion\": \"description\",\n" +
                    "    \"weight_g\": number,\n" +
                    "    \"nutrition\": {\n" +
                    "      \"calories\": number,\n" +
                    "      \"protein\": number,\n" +
                    "      \"carbs\": number,\n" +
                    "      \"fat\": number,\n" +
                    "      \"fiber\": number\n" +
                    "    }\n" +
                    "  }],\n" +
                    "  \"total\": {\"calories\":num,\"protein\":num,\"carbs\":num,\"fat\":num,\"fiber\":num},\n" +
                    "  \"confidence\": \"high/medium/low\"\n" +
                    "}\n\n" +
                    "JSON only.";

            JSONObject imagePart = new JSONObject();
            imagePart.put("inline_data", new JSONObject()
                    .put("mime_type", "image/jpeg")
                    .put("data", base64Image));
            JSONArray parts = new JSONArray();
            parts.put(new JSONObject().put("text", prompt));
            parts.put(imagePart);
            
            // Add generation config matching geminiService.js
            JSONObject generationConfig = new JSONObject();
            generationConfig.put("temperature", 0);
            generationConfig.put("topK", 1);
            generationConfig.put("topP", 1.0);
            generationConfig.put("maxOutputTokens", 4096);
            generationConfig.put("candidateCount", 1);
            generationConfig.put("responseMimeType", "application/json");
            
            JSONObject requestBody = new JSONObject();
            requestBody.put("contents", new JSONArray().put(new JSONObject().put("parts", parts)));
            requestBody.put("generationConfig", generationConfig);

            Request request = new Request.Builder()
                    .url(GEMINI_API_URL + "?key=" + apiKey)
                    .post(RequestBody.create(requestBody.toString(), MediaType.parse("application/json")))
                    .build();
            Response response = client.newCall(request).execute();
            String responseBody = response.body().string();
            Log.d("GeminiApiClient", "Gemini API response: " + responseBody);
            if (!response.isSuccessful()) {
                Log.e("GeminiApiClient", "API call failed: " + response.code() + ", body: " + responseBody);
                return "Analysis failed";
            }
            return parseGeminiResponse(responseBody);
        } catch (Exception e) {
            Log.e("GeminiApiClient", "Error analyzing image", e);
            return "Error: " + e.getMessage();
        }
    }

    /**
     * Read an image file, downsample it if larger than maxDimension, and
     * return JPEG-compressed bytes.  This avoids loading a full-resolution
     * camera photo (10-25 MB) into a single byte[] + base64 string which
     * would need ~3x the file size in heap and cause OOM on low-RAM devices.
     */
    private byte[] readAndCompressImage(String path, int maxDimension) throws IOException {
        // 1. Decode bounds only (no pixel allocation)
        android.graphics.BitmapFactory.Options opts = new android.graphics.BitmapFactory.Options();
        opts.inJustDecodeBounds = true;
        android.graphics.BitmapFactory.decodeFile(path, opts);

        // 2. Calculate inSampleSize (power-of-2 down-scale)
        int w = opts.outWidth;
        int h = opts.outHeight;
        int inSampleSize = 1;
        while ((w / inSampleSize) > maxDimension || (h / inSampleSize) > maxDimension) {
            inSampleSize *= 2;
        }

        // 3. Decode with down-sampling
        opts.inSampleSize = inSampleSize;
        opts.inJustDecodeBounds = false;
        android.graphics.Bitmap bmp = android.graphics.BitmapFactory.decodeFile(path, opts);
        if (bmp == null) {
            throw new IOException("Failed to decode image: " + path);
        }

        // 4. Compress to JPEG bytes
        java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
        bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 80, bos);
        bmp.recycle();
        return bos.toByteArray();
    }

    private String parseGeminiResponse(String responseBody) {
        try {
            JSONObject obj = new JSONObject(responseBody);
            JSONArray candidates = obj.optJSONArray("candidates");
            if (candidates != null && candidates.length() > 0) {
                JSONObject first = candidates.getJSONObject(0);
                JSONObject contentObj = first.optJSONObject("content");
                if (contentObj != null) {
                    JSONArray parts = contentObj.optJSONArray("parts");
                    if (parts != null && parts.length() > 0) {
                        String text = parts.getJSONObject(0).optString("text", "No result");
                        // Remove triple backticks and 'json' if present
                        text = text.replaceAll("```json\\s*", "").replaceAll("```", "").trim();
                        return text;
                    }
                }
            }
        } catch (JSONException e) {
            Log.e("GeminiApiClient", "Error parsing response", e);
        }
        return "No result";
    }
}
