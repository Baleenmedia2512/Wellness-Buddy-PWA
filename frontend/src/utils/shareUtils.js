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
 * @param {boolean} options.whatsappOnly - If true, share directly to WhatsApp
 */
export const captureAndShare = async (element, options = {}) => {
  const {
    title = "My Meal Analysis",
    text = "Tracked with Wellness Valley",
    fileName = "wellness-valley-meal.png",
    whatsappOnly = true, // Default to WhatsApp sharing
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
      await shareNative(blob, { title, text, fileName, whatsappOnly });
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
 */
const shareNative = async (blob, { title, text, fileName, whatsappOnly }) => {
  try {
    // Convert blob to base64
    const base64Data = await blobToBase64(blob);

    // Remove the data:image/png;base64, prefix
    const base64String = base64Data.split(",")[1];

    // Save to filesystem temporarily with unique name
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${fileName}`;

    console.log("📝 Attempting to write file:", uniqueFileName);

    const savedFile = await Filesystem.writeFile({
      path: uniqueFileName,
      data: base64String,
      directory: Directory.Cache,
      recursive: true, // Ensure directory exists
    });

    console.log("✅ File saved to cache:", savedFile.uri);

    // Get the file URI - Capacitor automatically provides correct format
    let fileUri = savedFile.uri;

    // For Android, ensure we have the correct URI format
    if (isPlatform("android")) {
      console.log("📱 Android file URI:", fileUri);
      
      // Check if URI is valid
      if (!fileUri || fileUri === "") {
        throw new Error("Invalid file URI generated");
      }
    }

    try {
      // Use Capacitor Share API with proper options
      console.log("🔗 Initiating share with URI:", fileUri);
      
      const shareOptions = {
        title: title,
        text: text,
        url: fileUri,
        dialogTitle: whatsappOnly ? "Share to WhatsApp" : "Share via",
      };
      
      console.log("📤 Share options:", shareOptions);
      
      const shareResult = await Share.share(shareOptions);

      console.log("✅ Share completed:", shareResult);
      
      // Check if share was successful
      if (shareResult && shareResult.activityType) {
        console.log("📱 Shared via:", shareResult.activityType);
      }
    } catch (shareError) {
      console.error("❌ Share error:", shareError);
      console.error("❌ Share error details:", JSON.stringify(shareError));

      // If user didn't cancel, show error
      if (shareError && !shareError.message?.includes("cancel") && !shareError.message?.includes("User cancelled")) {
        alert(
          "Unable to share. Please make sure you have a sharing app (WhatsApp, Messages, etc.) installed.\n\nError: " + (shareError.message || "Unknown error"),
        );
      } else {
        console.log("ℹ️ User cancelled share");
      }
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
      }
    }, 10000);
  } catch (error) {
    console.error("❌ Native share failed:", error);
    alert("Failed to share image. Please try again.");
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
      "Image downloaded! Please open WhatsApp manually and attach the image from your downloads folder.",
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
