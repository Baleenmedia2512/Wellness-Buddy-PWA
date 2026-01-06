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
private static final String GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";
    private final String apiKey;
    private final OkHttpClient client;

    public GeminiApiClient(String apiKey) {
        this.apiKey = apiKey;
        this.client = new OkHttpClient();
    }

    public String analyzeImage(String imagePath) {
        try {
            byte[] imageBytes = readFileToBytes(imagePath);
            String base64Image = Base64.encodeToString(imageBytes, Base64.NO_WRAP);

            // Use the same prompt as geminiService.js
            String prompt = "Analyze this food image and return nutrition data in JSON format. Be quick but accurate.\n\n" +
                    "RULES:\n" +
                    "1. Estimate portions based on visual cues (plate size, typical servings)\n" +
                    "2. Use standard nutrition values\n" +
                    "3. Return concise JSON only\n\n" +
                    "FORMAT:\n" +
                    "{\n" +
                    "  \"foods\": [\n" +
                    "    {\n" +
                    "      \"name\": \"food name\",\n" +
                    "      \"portion\": \"description like '2 idlis' or '1 cup rice'\",\n" +
                    "      \"weight_g\": number,\n" +
                    "      \"nutrition\": {\n" +
                    "        \"calories\": number,\n" +
                    "        \"protein\": number,\n" +
                    "        \"carbs\": number,\n" +
                    "        \"fat\": number,\n" +
                    "        \"fiber\": number\n" +
                    "      }\n" +
                    "    }\n" +
                    "  ],\n" +
                    "  \"total\": {\n" +
                    "    \"calories\": number,\n" +
                    "    \"protein\": number,\n" +
                    "    \"carbs\": number,\n" +
                    "    \"fat\": number,\n" +
                    "    \"fiber\": number\n" +
                    "  },\n" +
                    "  \"confidence\": \"high/medium/low\"\n" +
                    "}\n\n" +
                    "Return valid JSON only, no markdown.";

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
            generationConfig.put("topP", 0.95);
            generationConfig.put("maxOutputTokens", 8192);
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

    private byte[] readFileToBytes(String path) throws IOException {
        File file = new File(path);
        FileInputStream fis = new FileInputStream(file);
        byte[] bytes = new byte[(int) file.length()];
        fis.read(bytes);
        fis.close();
        return bytes;
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
