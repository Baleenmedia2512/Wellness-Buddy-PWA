// src/utils/shareUtils.js
import html2canvas from "html2canvas";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import { debugLog } from './logger.js';

/**
 * Reliably check if running on native platform (not web browser)
 * Uses Capacitor.isNativePlatform() which is more accurate than isPlatform()
 */
const isNativePlatform = () => {
  return Capacitor.isNativePlatform();
};

/**
 * Pre-capture an element to a data URL during idle time, so a later share
 * tap can skip html2canvas entirely and go straight to the native share sheet.
 *
 * Returns a JPEG data URL on success, or null on failure (caller should fall
 * back to a live captureAndShare).
 *
 * Uses requestIdleCallback when available so the heavy paint never competes
 * with user interaction.
 */
export const precaptureShareImage = (element, options = {}) => {
  const { scale = 1.5, quality = 0.85 } = options;

  return new Promise((resolve) => {
    if (!element) {
      resolve(null);
      return;
    }

    const run = async () => {
      try {
        const start = performance.now();
        const canvas = await html2canvas(element, {
          backgroundColor: "#ffffff",
          scale,
          useCORS: true,
          allowTaint: false,
          logging: false,
          imageTimeout: 5000,
          removeContainer: true,
          scrollY: -window.scrollY,
          scrollX: -window.scrollX,
          foreignObjectRendering: false,
        });
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        debugLog(
          `🟢 Pre-captured share image in ${Math.round(performance.now() - start)} ms (${Math.round(dataUrl.length / 1024)} KB string)`,
        );
        resolve(dataUrl);
      } catch (err) {
        console.warn("⚠️ Pre-capture failed (will fall back to live capture):", err);
        resolve(null);
      }
    };

    // Schedule on idle so it never competes with rendering or user input.
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 50);
    }
  });
};

/**
 * Share a previously pre-captured data URL via the fastest available channel.
 * On Android this hits the custom WhatsAppShare plugin directly — no
 * html2canvas, no toBlob, no FileReader. Tap → share sheet is typically
 * 200–400 ms instead of several seconds.
 *
 * Returns true on success, false if the caller should fall back to a live
 * captureAndShare on the original element.
 */
export const shareCachedDataUrl = async (dataUrl, options = {}) => {
  const {
    title = "Wellness Valley",
    text = "",
    fileName = "wellness-valley.jpg",
  } = options;

  if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return false;
  }

  const mimeType = dataUrl.substring(5, dataUrl.indexOf(";")) || "image/jpeg";
  const finalFileName = fileName.replace(/\.png$/i, ".jpg");

  // Android fast path — custom plugin accepts base64 directly.
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    try {
      const { WhatsAppShare } = Capacitor.Plugins;
      if (!WhatsAppShare) return false;

      const start = performance.now();
      await WhatsAppShare.shareImage({
        base64Data: dataUrl,
        fileName: finalFileName,
        title,
        text,
        mimeType,
      });
      debugLog(
        `⚡ Cached share dispatched in ${Math.round(performance.now() - start)} ms`,
      );
      return true;
    } catch (err) {
      const isCanceled =
        err?.message?.toLowerCase().includes("cancel") ||
        err?.message?.toLowerCase().includes("cancelled");
      if (isCanceled) {
        debugLog("ℹ️ User cancelled cached share");
        return true; // treat as handled
      }
      console.warn("⚠️ Cached share failed, will fall back:", err);
      return false;
    }
  }

  // iOS / web — convert dataURL to blob and reuse existing pipeline.
  try {
    const resp = await fetch(dataUrl);
    const blob = await resp.blob();
    const isNative = Capacitor.isNativePlatform();
    if (isNative) {
      await shareNative(blob, {
        title,
        text,
        fileName: finalFileName,
        shareAsDocument: true,
        mimeType,
      });
    } else {
      await shareWithRetryAndFallback(blob, {
        title,
        text,
        fileName: finalFileName,
        shareAsDocument: true,
      });
    }
    return true;
  } catch (err) {
    console.warn("⚠️ Cached share dataURL→blob path failed:", err);
    return false;
  }
};

/**
 * Share an actual image directly (original quality, no screenshot)
 * @param {string} imageUrl - The image URL (data URL or blob URL)
 * @param {Object} options - Share options
 * @param {string} options.title - Share title
 * @param {string} options.text - Share message text
 * @param {string} options.fileName - Name of the file to save/share
 * @param {boolean} options.shareAsDocument - If true, share as document (prevents WhatsApp compression)
 */
export const shareImageDirectly = async (imageUrl, options = {}) => {
  const {
    title = "My Meal Analysis",
    text = "",
    fileName = "wellness-valley-meal.png",
    shareAsDocument = true, // Share as document to prevent WhatsApp compression
  } = options;

  try {
    debugLog("📸 Starting direct image share...");
    const isNative = isNativePlatform();
    debugLog(
      "📱 Platform check - Native:",
      isNative,
      "| Capacitor.platform:",
      Capacitor.getPlatform(),
    );

    // Convert image URL to blob
    let blob;
    if (imageUrl.startsWith("data:")) {
      // Data URL - convert to blob
      const response = await fetch(imageUrl);
      blob = await response.blob();
    } else if (imageUrl.startsWith("http")) {
      // Remote URL - fetch and convert
      const response = await fetch(imageUrl, { mode: "cors" });
      blob = await response.blob();
    } else {
      // Blob URL - convert to blob
      const response = await fetch(imageUrl);
      blob = await response.blob();
    }

    debugLog("✅ Image blob created:", blob.size, "bytes", blob.type);

    if (isNative) {
      // Native mobile sharing (Capacitor)
      debugLog("📱 Using native share (Android/iOS app)");
      await shareNativeImage(blob, { title, text, fileName, shareAsDocument });
    } else {
      // Web browser - try share with fallback to download
      debugLog("💻 Web browser detected, attempting share with fallback...");
      await shareWithRetryAndFallback(blob, { title, text, fileName, shareAsDocument });
    }

    debugLog("✅ Direct image share completed successfully");
  } catch (error) {
    console.error("❌ Direct image share failed:", error);
    throw new Error("Failed to share image. Please try again.");
  }
};

/**
 * Native share for direct images (same as shareNative but for clarity)
 */
const shareNativeImage = async (
  blob,
  { title, text, fileName, shareAsDocument },
) => {
  return shareNative(blob, { title, text, fileName, shareAsDocument });
};

/**
 * Captures an HTML element as an image and shares it using native share functionality
 * @param {HTMLElement} element - The DOM element to capture
 * @param {Object} options - Share options
 * @param {string} options.title - Share title
 * @param {string} options.text - Share message text
 * @param {string} options.fileName - Name of the file to save/share
 * @param {boolean} options.shareAsDocument - If true, share as document (prevents WhatsApp compression)
 */
export const captureAndShare = async (element, options = {}) => {
  const {
    title = "My Meal Analysis",
    text = "",
    fileName = "wellness-valley-meal.png",
    shareAsDocument = true, // Share as document to prevent WhatsApp compression
  } = options;

  try {
    debugLog("📸 Starting capture and share process...");
    const isNative = isNativePlatform();
    debugLog(
      "📱 Platform check - Native:",
      isNative,
      "| Capacitor.platform:",
      Capacitor.getPlatform(),
    );

    // Ensure all images in the element are fully loaded before capture
    // On web browser, skip waiting — images are already rendered on screen.
    // Waiting breaks the user gesture window needed for navigator.share().
    const images = element.querySelectorAll("img");
    debugLog("🖼️ Found", images.length, "images in element");

    if (isNative) {
      // Native app: only wait for images that aren't ready yet, with a tight cap.
      // Most of the time every image is already decoded — don't pay any latency for them.
      const pending = Array.from(images).filter(
        (img) => !(img.complete && img.naturalWidth > 0),
      );
      if (pending.length > 0) {
        await Promise.all(
          pending.map(
            (img) =>
              new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 600); // hard cap — don't block share sheet
              }),
          ),
        );
      }
    } else {
      // Web browser: skip all waits — every ms counts for the gesture window.
      // Images visible on screen are already decoded by the browser.
      debugLog("💻 Web: skipping image-load wait to preserve gesture context for navigator.share()");
    }

    // Log element dimensions
    debugLog("📏 Element dimensions:", {
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      offsetWidth: element.offsetWidth,
      offsetHeight: element.offsetHeight,
      clientHeight: element.clientHeight,
    });

    // Step 1: Capture the element as canvas
    // Native app: scale 1.5. Phone DPR (2–3x) already makes the on-screen DOM
    //   crisp; 1.5× of that is more than enough for WhatsApp/share targets and
    //   roughly halves html2canvas paint time + JPEG encode time + bridge
    //   transfer size compared to scale 2 — the single biggest cut to the
    //   "tap Share → sheet appears" latency.
    // Web browser: scale 2 — Web Share API on Android Chrome rejects files >5 MB,
    //   but on web there's no Capacitor bridge cost so 2× is fine.
    const webScale = 2;
    const nativeScale = 1.5;
    const captureScale = isNative ? nativeScale : webScale;
    debugLog(`📐 Capture scale: ${captureScale}x`);

    const captureStart = performance.now();
    const canvas = await html2canvas(element, {
      backgroundColor: "#ffffff",
      scale: captureScale,
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 5000,
      removeContainer: true,
      scrollY: -window.scrollY,
      scrollX: -window.scrollX,
      foreignObjectRendering: false,
      // No onclone hook: forcing maxWidth/naturalWidth on every image was both slow
      // and risky (could balloon the captured canvas to many MB and cause layout
      // shifts). Images already render at their on-screen size, which is what we want.
    });
    debugLog(`⏱️ html2canvas took ${Math.round(performance.now() - captureStart)} ms`);

    debugLog(
      "✅ Canvas created successfully with dimensions:",
      canvas.width,
      "x",
      canvas.height,
    );

    // FAST PATH (Android native): skip toBlob + FileReader round-trip.
    //   canvas.toDataURL() returns base64 in a single pass — exactly the format
    //   the custom WhatsAppShare plugin needs. This removes one full image
    //   re-encode and the async FileReader, which together can add hundreds of
    //   ms on mid-range Android devices and is the single biggest contributor
    //   to "share sheet takes too long to open".
    if (isNative && Capacitor.getPlatform() === "android") {
      const dataUrlMime = "image/jpeg";
      const dataUrlQuality = 0.85;
      const fastFileName = fileName.replace(/\.png$/i, ".jpg");

      const dataUrlStart = performance.now();
      const dataUrl = canvas.toDataURL(dataUrlMime, dataUrlQuality);
      debugLog(
        `⏱️ canvas.toDataURL took ${Math.round(performance.now() - dataUrlStart)} ms (${Math.round(dataUrl.length / 1024)} KB string, ~${Math.round((dataUrl.length * 0.75) / 1024)} KB binary)`,
      );

      try {
        const { WhatsAppShare } = Capacitor.Plugins;
        if (!WhatsAppShare) {
          throw new Error("WhatsAppShare plugin not available");
        }

        const pluginStart = performance.now();
        const result = await WhatsAppShare.shareImage({
          base64Data: dataUrl,
          fileName: fastFileName,
          title,
          text,
          mimeType: dataUrlMime,
        });
        debugLog(
          `✅ Native share intent launched in ${Math.round(performance.now() - pluginStart)} ms (fast path)`,
          result,
        );
        return;
      } catch (pluginError) {
        const isCanceled =
          pluginError?.message?.toLowerCase().includes("cancel") ||
          pluginError?.message?.toLowerCase().includes("cancelled");
        if (isCanceled) {
          debugLog("ℹ️ User cancelled share (fast path)");
          return;
        }
        console.warn(
          "⚠️ Fast path failed, falling back to standard toBlob path:",
          pluginError,
        );
        // Fall through to standard path below.
      }
    }

    // Step 2: Convert canvas to blob
    // Native + web both use JPEG @ 0.85 — visually indistinguishable from 0.95 for UI
    // screenshots but roughly half the file size, which directly cuts base64 encoding,
    // Capacitor bridge transfer time, disk write time, and the receiving app's read time.
    const webMimeType = "image/jpeg";
    const webQuality = 0.85;
    const nativeMimeType = "image/jpeg";
    const nativeQuality = 0.85;
    const mimeType = isNative ? nativeMimeType : webMimeType;
    const quality = isNative ? nativeQuality : webQuality;
    const nativeFileName = fileName.replace(/\.png$/i, ".jpg");
    const webFileName = fileName.replace(/\.png$/i, ".jpg");
    const finalFileName = isNative ? nativeFileName : webFileName;

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to create blob from canvas"));
        },
        mimeType,
        quality,
      );
    });

    const fileSizeKB = Math.round(blob.size / 1024);
    debugLog(
      `✅ Blob created (${isNative ? "JPEG native-optimised" : "JPEG web-optimised"}):`,
      blob.size,
      "bytes (",
      fileSizeKB,
      "KB)",
    );
    debugLog("   Resolution:", canvas.width, "x", canvas.height, "pixels");

    // Step 3: Share based on platform (native or web browser)
    if (isNative) {
      // Native mobile sharing (Capacitor)
      debugLog("📱 Using native share (Android/iOS app)");
      await shareNative(blob, { title, text, fileName: finalFileName, shareAsDocument, mimeType });
    } else {
      // Web browser - try Web Share API with fallback to download
      debugLog("💻 Web browser detected, attempting share with fallback...");
      await shareWithRetryAndFallback(blob, { title, text, fileName: finalFileName, shareAsDocument });
    }

    debugLog("✅ Share completed successfully");
  } catch (error) {
    console.error("❌ Share failed:", error);

    // Show user-friendly error message
    if (error.message && error.message.includes("Share canceled")) {
      debugLog("ℹ️ User canceled share");
    } else {
      throw new Error("Failed to share image. Please try again.");
    }
  }
};

/**
 * Native mobile share using Capacitor Share plugin
 * Enhanced with better Android support and error handling
 * Supports sharing as document to prevent WhatsApp compression
 */
const shareNative = async (
  blob,
  { title, text, fileName, shareAsDocument = true, mimeType = "image/jpeg" },
) => {
  try {
    // Convert blob to base64
    const b64Start = performance.now();
    const base64Data = await blobToBase64(blob);
    debugLog(
      `📝 Base64 ready in ${Math.round(performance.now() - b64Start)} ms (${Math.round(base64Data.length / 1024)} KB string)`,
    );

    // For Android, use custom WhatsAppSharePlugin for better quality
    if (Capacitor.getPlatform() === "android") {
      debugLog(
        "📱 Android detected - using custom WhatsAppSharePlugin for high-quality sharing",
      );

      try {
        // Use custom Android plugin that prevents compression
        const { WhatsAppShare } = Capacitor.Plugins;

        if (!WhatsAppShare) {
          throw new Error("WhatsAppShare plugin not available");
        }

        debugLog(
          `💾 Sharing via custom plugin (${mimeType})...`,
        );
        debugLog(
          "   File size:",
          Math.round(blob.size / 1024),
          "KB",
        );

        const pluginStart = performance.now();
        const result = await WhatsAppShare.shareImage({
          base64Data: base64Data,
          fileName: fileName,
          title: title,
          text: text,
          mimeType: mimeType,
        });
        debugLog(
          `✅ Native share intent launched in ${Math.round(performance.now() - pluginStart)} ms`,
          result,
        );
        return;
      } catch (pluginError) {
        console.error("❌ Custom plugin share failed:", pluginError);

        // Check if user canceled
        const isCanceled =
          pluginError?.message?.toLowerCase().includes("cancel") ||
          pluginError?.message?.toLowerCase().includes("cancelled");

        if (isCanceled) {
          debugLog("ℹ️ User cancelled share");
          return;
        }

        // Fall back to standard Capacitor share method
        debugLog("⚠️ Falling back to standard Capacitor share...");
        // Continue to fallback method below
      }
    }

    // iOS or Android fallback - use standard Capacitor share
    // For Android, use external storage for better sharing compatibility
    const platform = Capacitor.getPlatform();
    if (platform === "android" || platform === "ios") {
      debugLog("📱 Using standard Capacitor share method");

      try {
        const timestamp = Date.now();
        const ext = mimeType === "image/png" ? "png" : "jpg";
        const uniqueFileName = `wellness-valley-${timestamp}.${ext}`;
        const base64String = base64Data.split(",")[1];

        // Write to Cache directory (always exists, no permission issues)
        debugLog("💾 Writing file to cache storage...");
        debugLog(
          "📄 Document mode:",
          shareAsDocument ? "ENABLED (prevents compression)" : "DISABLED",
        );
        const writeResult = await Filesystem.writeFile({
          path: uniqueFileName,
          data: base64String,
          directory: Directory.Cache,
        });

        debugLog("✅ File written:", writeResult.uri);

        // Get the content URI
        let fileUri = writeResult.uri;

        // Log the URI for debugging
        debugLog("🔍 Original URI from writeFile:", fileUri);
        debugLog(
          "🔍 URI starts with content://:",
          fileUri.startsWith("content://"),
        );
        debugLog(
          "🔍 URI starts with file://:",
          fileUri.startsWith("file://"),
        );

        // When shareAsDocument is true, include text to trigger document mode in WhatsApp
        // This prevents automatic compression and maintains full image quality
        const shareOptions = {
          title: title,
          text: shareAsDocument ? text : undefined, // Include text for document mode
          files: [fileUri],
          dialogTitle: "Share via",
        };

        debugLog(
          "💡 Share mode:",
          shareAsDocument ? "Document (full quality)" : "Image (may compress)",
        );

        debugLog("📤 Share options:", JSON.stringify(shareOptions, null, 2));

        // Check if Share API is available
        const canShare = await Share.canShare().catch(() => ({ value: false }));
        debugLog("📊 Can share:", canShare);

        if (!canShare.value) {
          throw new Error("Share API not available on this device");
        }

        // Perform the share
        debugLog(
          "🚀 Calling Share.share() with options:",
          JSON.stringify(shareOptions, null, 2),
        );
        const shareResult = await Share.share(shareOptions);

        debugLog("✅ Share completed:", shareResult);

        // Log activity type if available (iOS specific)
        if (shareResult && shareResult.activityType) {
          debugLog("📱 Shared via:", shareResult.activityType);
        }

        // Clean up the file from Cache after 2 minutes
        setTimeout(async () => {
          try {
            await Filesystem.deleteFile({
              path: uniqueFileName,
              directory: Directory.Cache,
            });
            debugLog("✅ Temporary file cleaned up from Cache");
          } catch (cleanupError) {
            console.warn("⚠️ Failed to clean up temporary file:", cleanupError);
          }
        }, 120000);
      } catch (shareError) {
        console.error("❌ Share error:", shareError);
        console.error("❌ Share error details:", JSON.stringify(shareError));

        // Check if user canceled the share
        const isCanceled =
          shareError?.message?.toLowerCase().includes("cancel") ||
          shareError?.message?.toLowerCase().includes("cancelled") ||
          shareError?.code === "0" ||
          shareError === "Share canceled";

        if (isCanceled) {
          debugLog("ℹ️ User cancelled share");
          // Don't throw error for user cancellation
          return;
        }

        // Show error for actual failures
        const errorMessage = shareError?.message || "Unknown error";
        alert(
          `Unable to share the image.\n\n` +
            `Error: ${errorMessage}\n\n` +
            `Please ensure:\n` +
            `1. You have sharing apps installed (Messages, WhatsApp, etc.)\n` +
            `2. Grant necessary permissions if prompted\n` +
            `3. Your device has enough storage space`,
        );

        throw shareError;
      }
    }
  } catch (error) {
    console.error("❌ Native share failed:", error);

    // Only alert if we haven't already shown an error
    if (!error?.message?.includes("cancelled")) {
      alert(
        "Failed to share image. Please try again or check your app permissions.",
      );
    }

    throw error;
  }
};

/**
 * Download image as a file
 * @param {Blob} blob - Image blob to download
 * @param {string} fileName - Name for the downloaded file
 */
const downloadImage = async (blob, fileName) => {
  debugLog("💾 Downloading image...");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  debugLog("✅ Image downloaded successfully");
  
  // Show helpful message
  alert(
    "Image downloaded successfully! You can now share it from your downloads folder.",
  );
};

/**
 * Try Web Share API with retry and fallback to download
 * Handles edge cases like Windows share dialog errors
 * 
 * FIX NOTES (Web Mobile Browser):
 * 1. Removed canShare() gate — it returns false on many mobile browsers even when
 *    file sharing IS supported, causing silent fallback to download.
 * 2. Removed text+files combination — mixing files+text causes NotAllowedError on
 *    iOS Safari and some Android browsers.
 * 3. navigator.share() is called as early as possible to stay within the user
 *    gesture context window. The blob is passed in pre-built to avoid async delays.
 * 4. WhatsApp on mobile web restricts file sharing via Web Share API — when this
 *    happens we fall back to download with a clear instruction to the user.
 * 
 * @param {Blob} blob - Image blob to share (pre-built before user gesture)
 * @param {Object} options - Share options
 */
const shareWithRetryAndFallback = async (blob, options) => {
  const { title, fileName } = options;

  // Check if Web Share API exists at all
  if (!navigator.share) {
    debugLog("❌ Web Share API not supported in this browser, falling back to download");
    await downloadImage(blob, fileName);
    return;
  }

  try {
    debugLog("📤 Attempting Web Share API (files only, no text to avoid NotAllowedError)...");

    // ✅ Use blob.type so MIME matches the actual content (JPEG on web, PNG on native fallback)
    const file = new File([blob], fileName, { type: blob.type });
    debugLog(`📄 File prepared: ${fileName} | type: ${blob.type} | size: ${Math.round(blob.size / 1024)} KB`);

    // Share with files + title only — DO NOT include text when sharing files.
    // Mixing files+text breaks sharing on iOS Safari and many Android browsers.
    await navigator.share({
      files: [file],
      title: title,
    });

    debugLog("✅ Web Share API: share completed successfully!");
    return;

  } catch (error) {
    console.warn("⚠️ Web Share API failed:", error.name, "-", error.message);

    // User deliberately cancelled — no fallback, no alert
    if (error.name === "AbortError" ||
        error.message?.toLowerCase().includes("cancel")) {
      debugLog("ℹ️ User cancelled share");
      return;
    }

    // NotAllowedError = gesture chain broken OR browser blocked.
    // With JPEG + scale:2, file is ~300-700 KB so size is NOT the issue here.
    if (error.name === "NotAllowedError") {
      debugLog("⚠️ NotAllowedError — gesture context may have expired. Falling back to download.");
      await downloadImage(blob, fileName);
      alert(
        "Image saved to your downloads! 📥\n\n" +
        "To share on WhatsApp:\n" +
        "1. Open WhatsApp\n" +
        "2. Open the chat\n" +
        "3. Tap 📎 → Gallery → select the downloaded image"
      );
      return;
    }

    // File sharing not supported by this browser build — fall back to download
    if (error.name === "TypeError" || error.name === "DataError") {
      debugLog("⚠️ Browser does not support file sharing via Web Share API. Downloading instead.");
      await downloadImage(blob, fileName);
      return;
    }

    // Any other unexpected error — still fall back gracefully
    console.error("❌ Unexpected share error, falling back to download:", error);
    try {
      await downloadImage(blob, fileName);
    } catch (downloadError) {
      console.error("❌ Download also failed:", downloadError);
      alert("Unable to share or download. Please try again or check your browser settings.");
      throw downloadError;
    }
  }
};

/**
 * Convert blob to base64 string
 */
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Share directly to WhatsApp (if app is installed)
 * Note: This requires the WhatsApp app to be installed on the device
 */
export const shareToWhatsApp = async (element, message = "") => {
  try {
    // First capture the image
    const canvas = await html2canvas(element, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/png", 1.0);
    });

    const base64Data = await blobToBase64(blob);
    const base64String = base64Data.split(",")[1];

    // Save to filesystem
    const fileName = `wellness-valley-${Date.now()}.png`;
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64String,
      directory: Directory.Cache,
    });

    // On Android, we can use Share with specific app
    const shareResult = await Share.share({
      title: "Share to WhatsApp",
      text: message,
      url: savedFile.uri,
      dialogTitle: "Share to WhatsApp",
    });

    debugLog("✅ Shared to WhatsApp:", shareResult);

    // Clean up
    setTimeout(async () => {
      try {
        await Filesystem.deleteFile({
          path: fileName,
          directory: Directory.Cache,
        });
      } catch (error) {
        console.warn("⚠️ Failed to clean up temporary file:", error);
      }
    }, 5000);
  } catch (error) {
    console.error("❌ WhatsApp share failed:", error);
    throw new Error(
      "Failed to share to WhatsApp. Make sure WhatsApp is installed.",
    );
  }
};
