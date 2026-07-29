package com.wellnessvalley.app.plugins;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Saves a base64-encoded image into the device photo gallery (Pictures/WellnessValley).
 * Uses MediaStore on Android 10+ so WRITE_EXTERNAL_STORAGE / READ_MEDIA_IMAGES are not required.
 */
@CapacitorPlugin(name = "SaveToGallery")
public class SaveToGalleryPlugin extends Plugin {
    private static final String TAG = "SaveToGalleryPlugin";
    private static final String ALBUM = "WellnessValley";

    @PluginMethod
    public void saveImage(PluginCall call) {
        String base64 = call.getString("base64");
        String fileName = call.getString("fileName", "wellness-valley-" + System.currentTimeMillis() + ".png");
        String mimeType = call.getString("mimeType", "image/png");

        if (base64 == null || base64.trim().isEmpty()) {
            call.reject("base64 is required");
            return;
        }

        // Allow data-URL prefix from the web layer.
        int comma = base64.indexOf(',');
        if (base64.startsWith("data:") && comma >= 0) {
            base64 = base64.substring(comma + 1);
        }

        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            if (bytes == null || bytes.length == 0) {
                call.reject("Invalid base64 image data");
                return;
            }

            Uri savedUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                savedUri = saveWithMediaStore(fileName, mimeType, bytes);
            } else {
                savedUri = saveLegacy(fileName, bytes);
            }

            if (savedUri == null) {
                call.reject("Failed to save image to gallery");
                return;
            }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("uri", savedUri.toString());
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "saveImage failed", e);
            call.reject("Failed to save image to gallery: " + e.getMessage(), e);
        }
    }

    private Uri saveWithMediaStore(String fileName, String mimeType, byte[] bytes) throws Exception {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
        values.put(MediaStore.Images.Media.MIME_TYPE, mimeType);
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + ALBUM);
        values.put(MediaStore.Images.Media.IS_PENDING, 1);

        ContentResolver resolver = getContext().getContentResolver();
        Uri collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        Uri item = resolver.insert(collection, values);
        if (item == null) {
            throw new IllegalStateException("MediaStore insert returned null");
        }

        try (OutputStream out = resolver.openOutputStream(item)) {
            if (out == null) {
                throw new IllegalStateException("Could not open output stream");
            }
            out.write(bytes);
            out.flush();
        }

        values.clear();
        values.put(MediaStore.Images.Media.IS_PENDING, 0);
        resolver.update(item, values, null, null);
        return item;
    }

    @SuppressWarnings("deprecation")
    private Uri saveLegacy(String fileName, byte[] bytes) throws Exception {
        File pictures = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
        File albumDir = new File(pictures, ALBUM);
        if (!albumDir.exists() && !albumDir.mkdirs()) {
            throw new IllegalStateException("Could not create album directory");
        }
        File file = new File(albumDir, fileName);
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
            out.flush();
        }
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DATA, file.getAbsolutePath());
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
        return getContext().getContentResolver().insert(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            values
        );
    }
}
