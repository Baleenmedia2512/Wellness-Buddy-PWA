// src/utils/shareUtils.js
import html2canvas from "html2canvas";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { isPlatform } from "@ionic/react";

/**
 * Captures an HTML element as an image and shares it using native share functionality
 * @param {HTMLElement} element - The DOM element to capture
 * @param {Object} options - Share options
 * @param {string} options.title - Share title
 * @param {string} options.text - Share message text
 * @param {string} options.fileName - Name of the file to save/share
 * @param {boolean} options.whatsappOnly - If true, share directly to WhatsApp (COMMENTED OUT)
 */
export const captureAndShare = async (element, options = {}) => {
  const {
    title = "My Meal Analysis",
    text = "Tracked with Wellness Valley",
    fileName = "wellness-valley-meal.png",
    // whatsappOnly = true, // Default to WhatsApp sharing
  } = options;

  try {
    console.log("📸 Starting capture and share process...");

    // Step 1: Capture the element as canvas
    const canvas = await html2canvas(element, {
      backgroundColor: "#ffffff",
      scale: 2, // Higher quality for social media
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 0,
      removeContainer: true,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    console.log("✅ Canvas created successfully");

    // Step 2: Convert canvas to blob
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create blob from canvas"));
          }
        },
        "image/png",
        1.0,
      );
    });

    console.log("✅ Blob created:", blob.size, "bytes");

    // Step 3: Check if we're on a native platform (Android/iOS) or mobile browser
    const isNativePlatform =
      isPlatform("capacitor") || isPlatform("android") || isPlatform("ios");

    const isMobileBrowser =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    if (isNativePlatform) {
      // Native mobile sharing (Capacitor)
      await shareNative(blob, { title, text, fileName /*, whatsappOnly*/ });
    } else if (isMobileBrowser && navigator.share) {
      // Mobile browser with Web Share API
      console.log("📱 Mobile browser detected, using Web Share API");
      await shareWeb(blob, { title, text, fileName });
    } else {
      // Desktop or browser without share support
      await shareWeb(blob, { title, text, fileName });
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
 */
const shareNative = async (blob, { title, text, fileName /*, whatsappOnly*/ }) => {
  try {
    // Convert blob to base64
    const base64Data = await blobToBase64(blob);

    // Remove the data:image/png;base64, prefix
    const base64String = base64Data.split(",")[1];

    // Save to filesystem temporarily with unique name
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${fileName}`;

    console.log("📝 Attempting to write file:", uniqueFileName);

    // Write file to cache directory
    const savedFile = await Filesystem.writeFile({
      path: uniqueFileName,
      data: base64String,
      directory: Directory.Cache,
      recursive: true,
    });

    console.log("✅ File saved to cache:", savedFile.uri);

    // Get the file URI with proper formatting for Android
    let fileUri = savedFile.uri;

    // Android-specific URI handling
    if (isPlatform("android")) {
      console.log("📱 Android detected - processing file URI");
      console.log("📱 Original URI:", fileUri);
      
      // Validate URI
      if (!fileUri || fileUri === "") {
        throw new Error("Invalid file URI generated");
      }

      // Ensure proper content:// URI format for Android FileProvider
      // Capacitor should handle this automatically, but we'll verify
      if (!fileUri.startsWith("content://")) {
        console.warn("⚠️ URI doesn't start with content://, may cause issues");
      }
    }

    try {
      // Use Capacitor Share API with proper options
      console.log("🔗 Initiating native share with URI:", fileUri);
      
      const shareOptions = {
        title: title,
        text: text,
        url: fileUri,
        dialogTitle: "Share via",
      };
      
      console.log("📤 Share options:", JSON.stringify(shareOptions, null, 2));
      
      // Check if Share API is available
      const canShare = await Share.canShare().catch(() => ({ value: false }));
      console.log("📊 Can share:", canShare);
      
      if (!canShare.value) {
        throw new Error("Share API not available on this device");
      }

      // Perform the share
      const shareResult = await Share.share(shareOptions);

      console.log("✅ Share completed:", shareResult);
      
      // Log activity type if available (iOS specific)
      if (shareResult && shareResult.activityType) {
        console.log("📱 Shared via:", shareResult.activityType);
      }
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
        `3. Your device has enough storage space`
      );
      
      throw shareError;
    }

    // Clean up the temporary file after a delay
    setTimeout(async () => {
      try {
        await Filesystem.deleteFile({
          path: uniqueFileName,
          directory: Directory.Cache,
        });
        console.log("✅ Temporary file cleaned up");
      } catch (error) {
        console.warn("⚠️ Failed to clean up temporary file:", error);
        // Don't throw error for cleanup failures
      }
    }, 10000);
  } catch (error) {
    console.error("❌ Native share failed:", error);
    
    // Only alert if we haven't already shown an error
    if (!error?.message?.includes("cancelled")) {
      alert("Failed to share image. Please try again or check your app permissions.");
    }
    
    throw error;
  }
};

/**
 * Web fallback share using Web Share API or download
 */
const shareWeb = async (blob, { title, text, fileName }) => {
  try {
    // First try: Web Share API with files (best option)
    if (navigator.share) {
      const file = new File([blob], fileName, { type: "image/png" });

      // Try sharing with file
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
          });
          console.log("✅ Shared via Web Share API with file");
          return;
        } catch (shareError) {
          if (shareError.name === "AbortError") {
            console.log("ℹ️ User canceled share");
            return;
          }
          console.log("⚠️ Share with file failed, trying text only...");
        }
      }

      // Second try: Share text only (will still open share sheet)
      try {
        await navigator.share({
          title: title,
          text: text,
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
