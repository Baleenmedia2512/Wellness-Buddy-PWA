// src/utils/shareUtils.js
import html2canvas from "html2canvas";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { isPlatform } from "@ionic/react";
import { Capacitor } from "@capacitor/core";

/**
 * Reliably check if running on native platform (not web browser)
 * Uses Capacitor.isNativePlatform() which is more accurate than isPlatform()
 */
const isNativePlatform = () => {
  return Capacitor.isNativePlatform();
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
    console.log("📸 Starting direct image share...");
    const isNative = isNativePlatform();
    console.log(
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

    console.log("✅ Image blob created:", blob.size, "bytes", blob.type);

    if (isNative) {
      // Native mobile sharing (Capacitor)
      console.log("📱 Using native share (Android/iOS app)");
      await shareNativeImage(blob, { title, text, fileName, shareAsDocument });
    } else {
      // Web browser - try share with fallback to download
      console.log("💻 Web browser detected, attempting share with fallback...");
      await shareWithRetryAndFallback(blob, { title, text, fileName, shareAsDocument });
    }

    console.log("✅ Direct image share completed successfully");
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
    console.log("📸 Starting capture and share process...");
    const isNative = isNativePlatform();
    console.log(
      "📱 Platform check - Native:",
      isNative,
      "| Capacitor.platform:",
      Capacitor.getPlatform(),
    );

    // Ensure all images in the element are fully loaded before capture
    // On web browser, skip waiting — images are already rendered on screen.
    // Waiting breaks the user gesture window needed for navigator.share().
    const images = element.querySelectorAll("img");
    console.log("🖼️ Found", images.length, "images in element");

    if (isNative) {
      // Native app: wait for images (gesture window is not a concern here)
      await Promise.all(
        Array.from(images).map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 2000);
          });
        }),
      );
      // Quick delay for rendering (native only)
      await new Promise((resolve) => setTimeout(resolve, 200));
    } else {
      // Web browser: skip all waits — every ms counts for the gesture window.
      // Images visible on screen are already decoded by the browser.
      console.log("💻 Web: skipping image-load wait to preserve gesture context for navigator.share()");
    }

    // Log element dimensions
    console.log("📏 Element dimensions:", {
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      offsetWidth: element.offsetWidth,
      offsetHeight: element.offsetHeight,
      clientHeight: element.clientHeight,
    });

    // Step 1: Capture the element as canvas
    // Native app: scale 5 (ultra-high quality, survives WhatsApp compression)
    // Web browser: scale 2 (~1-2 MB) — Web Share API on Android Chrome rejects files >5 MB,
    //              causing silent fallback to download instead of opening the share sheet.
    const webScale = 2;
    const nativeScale = 5;
    const captureScale = isNative ? nativeScale : webScale;
    console.log(`📐 Capture scale: ${captureScale}x (${isNative ? "native app — max quality" : "web browser — optimised for Web Share API"})`);

    const canvas = await html2canvas(element, {
      backgroundColor: "#ffffff",
      scale: captureScale,
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 15000,
      removeContainer: true,
      scrollY: -window.scrollY,
      scrollX: -window.scrollX,
      foreignObjectRendering: false,
      // ULTRA HIGH QUALITY IMAGE RENDERING
      onclone: (clonedDoc) => {
        // Force high quality rendering for all images
        const images = clonedDoc.getElementsByTagName("img");
        for (let img of images) {
          // Use high-quality rendering (no blur, no smoothing)
          img.style.imageRendering = "-webkit-optimize-contrast";
          img.style.WebkitImageRendering = "-webkit-optimize-contrast";
          img.style.imageRendering = "crisp-edges";
          img.style.maxWidth = "none";
          img.style.maxHeight = "none";
          // Disable any potential compression or smoothing
          img.style.imageSmoothing = "false";
          // Force full resolution
          if (img.naturalWidth) {
            img.width = img.naturalWidth;
            img.height = img.naturalHeight;
          }
        }
      },
    });

    console.log(
      "✅ Canvas created successfully with dimensions:",
      canvas.width,
      "x",
      canvas.height,
    );

    // Step 2: Convert canvas to blob
    // Native app  → PNG lossless (survives WhatsApp compression at full quality)
    // Web browser → JPEG quality 0.90 (~300–700 KB vs 3–18 MB for PNG)
    //   Web Share API on Android Chrome silently rejects files over ~5 MB.
    //   JPEG keeps the file small so the share sheet opens with WhatsApp visible.
    const webMimeType = "image/jpeg";
    const webQuality = 0.90;
    const nativeMimeType = "image/png";
    const mimeType = isNative ? nativeMimeType : webMimeType;
    const quality = isNative ? 1.0 : webQuality;
    const webFileName = isNative ? fileName : fileName.replace(/\.png$/i, ".jpg");

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
    console.log(
      `✅ Blob created (${isNative ? "PNG lossless" : "JPEG web-optimised"}):`,
      blob.size,
      "bytes (",
      fileSizeKB,
      "KB)",
    );
    console.log("   Resolution:", canvas.width, "x", canvas.height, "pixels");

    // Step 3: Share based on platform (native or web browser)
    if (isNative) {
      // Native mobile sharing (Capacitor)
      console.log("📱 Using native share (Android/iOS app)");
      await shareNative(blob, { title, text, fileName, shareAsDocument });
    } else {
      // Web browser - try Web Share API with fallback to download
      console.log("💻 Web browser detected, attempting share with fallback...");
      await shareWithRetryAndFallback(blob, { title, text, fileName: webFileName, shareAsDocument });
    }

    console.log("✅ Share completed successfully");
  } catch (error) {
    console.error("❌ Share failed:", error);

    // Show user-friendly error message
    if (error.message && error.message.includes("Share canceled")) {
      console.log("ℹ️ User canceled share");
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
  { title, text, fileName, shareAsDocument = true },
) => {
  try {
    // Convert blob to base64
    const base64Data = await blobToBase64(blob);
    console.log(
      "📝 Base64 data prepared, size:",
      base64Data.length,
      "characters",
    );

    // For Android, use custom WhatsAppSharePlugin for better quality
    if (Capacitor.getPlatform() === "android") {
      console.log(
        "📱 Android detected - using custom WhatsAppSharePlugin for high-quality sharing",
      );

      try {
        // Use custom Android plugin that prevents compression
        const { WhatsAppShare } = Capacitor.Plugins;

        if (!WhatsAppShare) {
          throw new Error("WhatsAppShare plugin not available");
        }

        console.log(
          "💾 Sharing via custom HIGH-QUALITY plugin (zero compression)...",
        );
        console.log(
          "   Using lossless PNG format, file size:",
          Math.round(blob.size / 1024),
          "KB",
        );

        const result = await WhatsAppShare.shareImage({
          base64Data: base64Data,
          fileName: fileName,
          title: title,
          text: text,
        });

        console.log(
          "✅ Custom plugin share completed (full quality preserved):",
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
          console.log("ℹ️ User cancelled share");
          return;
        }

        // Fall back to standard Capacitor share method
        console.log("⚠️ Falling back to standard Capacitor share...");
        // Continue to fallback method below
      }
    }

    // iOS or Android fallback - use standard Capacitor share
    // For Android, use external storage for better sharing compatibility
    const platform = Capacitor.getPlatform();
    if (platform === "android" || platform === "ios") {
      console.log("📱 Using standard Capacitor share method");

      try {
        const timestamp = Date.now();
        // Use .png extension for compatibility, but share with text to trigger document mode
        const uniqueFileName = `wellness-valley-${timestamp}.png`;
        const base64String = base64Data.split(",")[1];

        // Write to Cache directory (always exists, no permission issues)
        console.log("💾 Writing file to cache storage...");
        console.log(
          "📄 Document mode:",
          shareAsDocument ? "ENABLED (prevents compression)" : "DISABLED",
        );
        const writeResult = await Filesystem.writeFile({
          path: uniqueFileName,
          data: base64String,
          directory: Directory.Cache,
        });

        console.log("✅ File written:", writeResult.uri);

        // Get the content URI
        let fileUri = writeResult.uri;

        // Log the URI for debugging
        console.log("🔍 Original URI from writeFile:", fileUri);
        console.log(
          "🔍 URI starts with content://:",
          fileUri.startsWith("content://"),
        );
        console.log(
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

        console.log(
          "💡 Share mode:",
          shareAsDocument ? "Document (full quality)" : "Image (may compress)",
        );

        console.log("📤 Share options:", JSON.stringify(shareOptions, null, 2));

        // Check if Share API is available
        const canShare = await Share.canShare().catch(() => ({ value: false }));
        console.log("📊 Can share:", canShare);

        if (!canShare.value) {
          throw new Error("Share API not available on this device");
        }

        // Perform the share
        console.log(
          "🚀 Calling Share.share() with options:",
          JSON.stringify(shareOptions, null, 2),
        );
        const shareResult = await Share.share(shareOptions);

        console.log("✅ Share completed:", shareResult);

        // Log activity type if available (iOS specific)
        if (shareResult && shareResult.activityType) {
          console.log("📱 Shared via:", shareResult.activityType);
        }

        // Clean up the file from Cache after 2 minutes
        setTimeout(async () => {
          try {
            await Filesystem.deleteFile({
              path: uniqueFileName,
              directory: Directory.Cache,
            });
            console.log("✅ Temporary file cleaned up from Cache");
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
          console.log("ℹ️ User cancelled share");
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
  console.log("💾 Downloading image...");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  console.log("✅ Image downloaded successfully");
  
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
    console.log("❌ Web Share API not supported in this browser, falling back to download");
    await downloadImage(blob, fileName);
    return;
  }

  try {
    console.log("📤 Attempting Web Share API (files only, no text to avoid NotAllowedError)...");

    // ✅ Use blob.type so MIME matches the actual content (JPEG on web, PNG on native fallback)
    const file = new File([blob], fileName, { type: blob.type });
    console.log(`📄 File prepared: ${fileName} | type: ${blob.type} | size: ${Math.round(blob.size / 1024)} KB`);

    // Share with files + title only — DO NOT include text when sharing files.
    // Mixing files+text breaks sharing on iOS Safari and many Android browsers.
    await navigator.share({
      files: [file],
      title: title,
    });

    console.log("✅ Web Share API: share completed successfully!");
    return;

  } catch (error) {
    console.warn("⚠️ Web Share API failed:", error.name, "-", error.message);

    // User deliberately cancelled — no fallback, no alert
    if (error.name === "AbortError" ||
        error.message?.toLowerCase().includes("cancel")) {
      console.log("ℹ️ User cancelled share");
      return;
    }

    // NotAllowedError = gesture chain broken OR browser blocked.
    // With JPEG + scale:2, file is ~300-700 KB so size is NOT the issue here.
    if (error.name === "NotAllowedError") {
      console.log("⚠️ NotAllowedError — gesture context may have expired. Falling back to download.");
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
      console.log("⚠️ Browser does not support file sharing via Web Share API. Downloading instead.");
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
 * Web fallback share using Web Share API or download
 * 
 * FIX NOTES (Web Mobile Browser):
 * - Removed canShare() gate and text+files combination (both cause silent failures
 *   on mobile Chrome/Safari and iOS Safari respectively).
 * - Uses files+title only — the safest combination across all mobile browsers.
 * - Falls back to download with clear WhatsApp instructions when Web Share fails.
 * 
 * @param {boolean} shareAsDocument - Kept for API compatibility, not used on web
 */
const shareWeb = async (
  blob,
  { title, fileName },
) => {
  try {
    // Try Web Share API with files only (no text — prevents NotAllowedError)
    if (navigator.share) {
      // ✅ Use blob.type so MIME matches actual content (JPEG on web)
      const file = new File([blob], fileName, { type: blob.type });

      try {
        await navigator.share({
          files: [file],
          title: title,
        });
        console.log("✅ Shared via Web Share API with file");
        return;
      } catch (shareError) {
        // User cancelled — stop here, no fallback
        if (shareError.name === "AbortError" ||
            shareError.message?.toLowerCase().includes("cancel")) {
          console.log("ℹ️ User canceled share");
          return;
        }

        // NotAllowedError — WhatsApp or browser blocked web file share
        if (shareError.name === "NotAllowedError") {
          console.log("⚠️ NotAllowedError — falling back to download with WhatsApp instructions");
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          alert(
            "Image saved to your downloads! 📥\n\n" +
            "To share on WhatsApp:\n" +
            "1. Open WhatsApp\n" +
            "2. Open the chat\n" +
            "3. Tap 📎 → Gallery → select the downloaded image"
          );
          return;
        }

        console.log("⚠️ Web Share API file share failed:", shareError.name, "— falling back to download");
      }
    }

    // Fallback: Download with instructions
    console.log("ℹ️ Web Share API not available or failed, downloading image...");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log("✅ Image downloaded");
    alert(
      "Image downloaded! You can now attach it from your downloads folder.",
    );
  } catch (error) {
    console.error("❌ Web share failed:", error);
    throw error;
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

    // Construct WhatsApp share intent URL
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;

    // On Android, we can use Share with specific app
    const shareResult = await Share.share({
      title: "Share to WhatsApp",
      text: message,
      url: savedFile.uri,
      dialogTitle: "Share to WhatsApp",
    });

    console.log("✅ Shared to WhatsApp:", shareResult);

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
