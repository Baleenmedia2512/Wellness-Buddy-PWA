// src/utils/shareUtils.js
import html2canvas from "html2canvas";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { isPlatform } from "@ionic/react";
import { Capacitor } from "@capacitor/core";

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
    text = "Tracked with Wellness Valley",
    fileName = "wellness-valley-meal.png",
    shareAsDocument = true, // Share as document to prevent WhatsApp compression
  } = options;

  try {
    console.log("📸 Starting direct image share...");
    console.log(
      "📱 Platform check - Capacitor:",
      isPlatform("capacitor"),
      "Android:",
      isPlatform("android"),
      "iOS:",
      isPlatform("ios"),
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

    // Check if we're on a native platform (Android/iOS) or mobile browser
    const isNativePlatform =
      isPlatform("capacitor") || isPlatform("android") || isPlatform("ios");

    const isMobileBrowser =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    if (isNativePlatform) {
      // Native mobile sharing (Capacitor)
      await shareNativeImage(blob, { title, text, fileName, shareAsDocument });
    } else if (isMobileBrowser && navigator.share) {
      // Mobile browser with Web Share API
      console.log("📱 Mobile browser detected, using Web Share API");
      await shareWeb(blob, { title, text, fileName, shareAsDocument });
    } else {
      // Desktop or browser without share support
      await shareWeb(blob, { title, text, fileName, shareAsDocument });
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
    text = "Tracked with Wellness Valley",
    fileName = "wellness-valley-meal.png",
    shareAsDocument = true, // Share as document to prevent WhatsApp compression
  } = options;

  try {
    console.log("📸 Starting capture and share process...");
    console.log(
      "📱 Platform check - Capacitor:",
      isPlatform("capacitor"),
      "Android:",
      isPlatform("android"),
      "iOS:",
      isPlatform("ios"),
    );

    // Ensure all images in the element are fully loaded before capture
    const images = element.querySelectorAll("img");
    console.log("🖼️ Found", images.length, "images in element");

    await Promise.all(
      Array.from(images).map((img) => {
        if (img.complete && img.naturalWidth > 0) {
          console.log(
            "✅ Image already loaded:",
            img.src.substring(0, 50),
            `${img.naturalWidth}x${img.naturalHeight}`,
          );
          return Promise.resolve();
        }
        console.log("⏳ Waiting for image to load:", img.src.substring(0, 50));
        return new Promise((resolve) => {
          img.onload = () => {
            console.log(
              "✅ Image loaded:",
              img.src.substring(0, 50),
              `${img.naturalWidth}x${img.naturalHeight}`,
            );
            resolve();
          };
          img.onerror = () => {
            console.log("⚠️ Image failed to load:", img.src.substring(0, 50));
            resolve(); // Continue anyway
          };
          // Fallback timeout
          setTimeout(resolve, 2000);
        });
      }),
    );

    // Quick delay for rendering
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Log element dimensions
    console.log("📏 Element dimensions:", {
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      offsetWidth: element.offsetWidth,
      offsetHeight: element.offsetHeight,
      clientHeight: element.clientHeight,
    });

    // Step 1: Capture the element as canvas with MAXIMUM QUALITY
    // Using 3x scale on a 1200px wide card = 3600px final width (ultra high quality)
    const canvas = await html2canvas(element, {
      backgroundColor: "#ffffff",
      scale: 3, // 3x scale = 3600px width for crystal clear quality
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 10000,
      removeContainer: true,
      scrollY: -window.scrollY,
      scrollX: -window.scrollX,
      foreignObjectRendering: false,
      // HIGH QUALITY IMAGE RENDERING
      onclone: (clonedDoc) => {
        // Force high quality rendering for all images
        const images = clonedDoc.getElementsByTagName("img");
        for (let img of images) {
          // Use crisp-edges for sharp rendering (no blur)
          img.style.imageRendering = "crisp-edges";
          img.style.WebkitImageRendering = "crisp-edges";
          img.style.maxWidth = "none";
          img.style.maxHeight = "none";
          // Disable any potential compression
          img.style.imageSmoothing = "false";
        }
      },
    });

    console.log(
      "✅ Canvas created successfully with dimensions:",
      canvas.width,
      "x",
      canvas.height,
    );

    // Step 2: Convert canvas to LOSSLESS PNG blob (NO COMPRESSION)
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create blob from canvas"));
          }
        },
        "image/png", // PNG = lossless format (no quality loss)
        1.0, // Quality parameter (1.0 = maximum, though PNG is always lossless)
      );
    });

    const fileSizeKB = Math.round(blob.size / 1024);
    console.log(
      "✅ High-quality PNG blob created:",
      blob.size,
      "bytes (",
      fileSizeKB,
      "KB)",
    );
    console.log("   Resolution:", canvas.width, "x", canvas.height, "pixels");

    // Step 3: Check if we're on a native platform (Android/iOS) or mobile browser
    const isNativePlatform =
      isPlatform("capacitor") || isPlatform("android") || isPlatform("ios");

    const isMobileBrowser =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    if (isNativePlatform) {
      // Native mobile sharing (Capacitor)
      await shareNative(blob, { title, text, fileName, shareAsDocument });
    } else if (isMobileBrowser && navigator.share) {
      // Mobile browser with Web Share API
      console.log("📱 Mobile browser detected, using Web Share API");
      await shareWeb(blob, { title, text, fileName, shareAsDocument });
    } else {
      // Desktop or browser without share support
      await shareWeb(blob, { title, text, fileName, shareAsDocument });
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
    if (isPlatform("android")) {
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
    if (isPlatform("android") || isPlatform("ios")) {
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
 * Web fallback share using Web Share API or download
 * @param {boolean} shareAsDocument - If true, share as document to prevent compression
 */
const shareWeb = async (
  blob,
  { title, text, fileName, shareAsDocument = true },
) => {
  try {
    // First try: Web Share API with files (best option)
    if (navigator.share) {
      const file = new File([blob], fileName, { type: "image/png" });

      // Try sharing with file (and text if document mode)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          const webShareOptions = {
            files: [file],
          };
          // Include text for document mode to prevent compression
          if (shareAsDocument) {
            webShareOptions.text = text;
            webShareOptions.title = title;
          }
          await navigator.share(webShareOptions);
          console.log(
            "✅ Shared via Web Share API with file",
            shareAsDocument ? "(document mode)" : "",
          );
          return;
        } catch (shareError) {
          if (shareError.name === "AbortError") {
            console.log("ℹ️ User canceled share");
            return;
          }
          console.log("⚠️ Share with file failed, trying text only...");
        }
      }

      // Second try: Share with title only (image couldn't be shared as file)
      try {
        await navigator.share({
          title: title,
        });
        console.log("✅ Shared via Web Share API (text only)");

        // Show message that image was not included
        alert(
          "Share initiated! Note: The image couldn't be automatically attached. You may need to add it manually.",
        );
        return;
      } catch (shareError) {
        if (shareError.name === "AbortError") {
          console.log("ℹ️ User canceled share");
          return;
        }
        console.log("⚠️ Text share also failed");
      }
    }

    // Last resort: Download with instructions
    console.log("ℹ️ Web Share API not available, downloading image...");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log("✅ Image downloaded");

    // Show helpful message
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
