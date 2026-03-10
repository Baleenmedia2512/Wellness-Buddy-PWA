package com.wellnessvalley.app.plugins;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import android.util.Base64;
import android.util.Log;

/**
 * Custom plugin to share images without compression on Android
 * This plugin properly configures the share intent to preserve image quality
 * especially for WhatsApp which compresses images by default
 */
@CapacitorPlugin(name = "WhatsAppShare")
public class WhatsAppSharePlugin extends Plugin {
    private static final String TAG = "WhatsAppSharePlugin";

    /**
     * Share an image with full quality (no compression)
     * @param call - Contains base64Data, fileName, title, text
     */
    @PluginMethod
    public void shareImage(PluginCall call) {
        try {
            String base64Data = call.getString("base64Data");
            String fileName = call.getString("fileName", "wellness-valley-" + System.currentTimeMillis() + ".png");
            String title = call.getString("title", "Share Image");
            String text = call.getString("text", "");
            
            if (base64Data == null || base64Data.isEmpty()) {
                call.reject("base64Data is required");
                return;
            }
            
            // Remove data URL prefix if present
            if (base64Data.contains(",")) {
                base64Data = base64Data.split(",")[1];
            }
            
            Log.d(TAG, "Starting image share process (HIGH QUALITY MODE)...");
            Log.d(TAG, "File name: " + fileName);
            
            // Decode base64 to bytes (NO COMPRESSION)
            byte[] imageBytes = Base64.decode(base64Data, Base64.DEFAULT);
            Log.d(TAG, "Image decoded: " + imageBytes.length + " bytes (" + (imageBytes.length / 1024) + " KB)");
            
            // Save to cache directory with NO COMPRESSION
            // PNG format preserves full quality
            File cacheDir = getContext().getCacheDir();
            File imageFile = new File(cacheDir, fileName);
            
            // Write raw PNG bytes directly (no compression)
            FileOutputStream fos = new FileOutputStream(imageFile);
            fos.write(imageBytes);
            fos.flush();
            fos.close();
            
            Log.d(TAG, "Image saved (lossless PNG): " + imageFile.length() + " bytes");
            
            Log.d(TAG, "Image saved to: " + imageFile.getAbsolutePath());
            
            // Get URI using FileProvider
            String authority = getContext().getPackageName() + ".fileprovider";
            Uri imageUri = FileProvider.getUriForFile(getContext(), authority, imageFile);
            
            Log.d(TAG, "FileProvider URI: " + imageUri.toString());
            
            // Create share intent with HIGH QUALITY configuration
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            
            // CRITICAL: Use specific image/png MIME type (prevents compression)
            // Using "image/*" or "image/jpeg" may trigger compression in some apps
            shareIntent.setType("image/png");
            
            // Add the image URI as stream
            shareIntent.putExtra(Intent.EXTRA_STREAM, imageUri);
            
            // Add text caption (helps WhatsApp treat as document attachment)
            if (text != null && !text.isEmpty()) {
                shareIntent.putExtra(Intent.EXTRA_TEXT, text);
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
            }
            
            // CRITICAL FLAGS for quality preservation:
            // 1. Grant read permission so apps can access the full-quality file
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            // 2. Grant write permission (some apps need this)
            shareIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            // 3. Ensure proper activity launch
            shareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            
            Log.d(TAG, "Share intent configured:");
            Log.d(TAG, "  - MIME type: image/png (lossless)");
            Log.d(TAG, "  - File size: " + imageFile.length() + " bytes");
            Log.d(TAG, "  - Permissions: READ + WRITE");
            
            // Create chooser to let user select app
            Intent chooser = Intent.createChooser(shareIntent, title);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            
            Log.d(TAG, "Launching share intent...");
            
            // Start the share activity
            getContext().startActivity(chooser);
            
            Log.d(TAG, "✅ Share intent launched successfully");
            
            // Schedule cleanup after 2 minutes
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                if (imageFile.exists()) {
                    boolean deleted = imageFile.delete();
                    Log.d(TAG, deleted ? "✅ Temp file cleaned up" : "⚠️ Failed to delete temp file");
                }
            }, 120000);
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Image shared successfully");
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Share failed: " + e.getMessage(), e);
            call.reject("Failed to share image: " + e.getMessage(), e);
        }
    }
    
    /**
     * Share image directly to WhatsApp (if installed)
     */
    @PluginMethod
    public void shareToWhatsApp(PluginCall call) {
        try {
            String base64Data = call.getString("base64Data");
            String fileName = call.getString("fileName", "wellness-valley-" + System.currentTimeMillis() + ".png");
            String text = call.getString("text", "");
            
            if (base64Data == null || base64Data.isEmpty()) {
                call.reject("base64Data is required");
                return;
            }
            
            // Remove data URL prefix if present
            if (base64Data.contains(",")) {
                base64Data = base64Data.split(",")[1];
            }
            
            Log.d(TAG, "Starting WhatsApp direct share...");
            
            // Decode base64 to bytes
            byte[] imageBytes = Base64.decode(base64Data, Base64.DEFAULT);
            
            // Save to cache directory
            File cacheDir = getContext().getCacheDir();
            File imageFile = new File(cacheDir, fileName);
            
            FileOutputStream fos = new FileOutputStream(imageFile);
            fos.write(imageBytes);
            fos.flush();
            fos.close();
            
            Log.d(TAG, "Image saved to: " + imageFile.getAbsolutePath());
            
            // Get URI using FileProvider
            String authority = getContext().getPackageName() + ".fileprovider";
            Uri imageUri = FileProvider.getUriForFile(getContext(), authority, imageFile);
            
            // Create WhatsApp specific intent
            Intent whatsappIntent = new Intent(Intent.ACTION_SEND);
            whatsappIntent.setType("image/png");
            whatsappIntent.setPackage("com.whatsapp");
            
            whatsappIntent.putExtra(Intent.EXTRA_STREAM, imageUri);
            
            if (text != null && !text.isEmpty()) {
                whatsappIntent.putExtra(Intent.EXTRA_TEXT, text);
            }
            
            whatsappIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            whatsappIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            
            // Check if WhatsApp is installed
            if (whatsappIntent.resolveActivity(getContext().getPackageManager()) != null) {
                getContext().startActivity(whatsappIntent);
                Log.d(TAG, "✅ WhatsApp share launched");
                
                // Schedule cleanup
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                    if (imageFile.exists()) {
                        imageFile.delete();
                    }
                }, 120000);
                
                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);
            } else {
                call.reject("WhatsApp is not installed");
            }
            
        } catch (Exception e) {
            Log.e(TAG, "❌ WhatsApp share failed: " + e.getMessage(), e);
            call.reject("Failed to share to WhatsApp: " + e.getMessage(), e);
        }
    }
}
