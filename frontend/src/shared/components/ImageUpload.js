// src\components\ImageUpload.js
import React, {
  forwardRef,
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Filesystem } from "@capacitor/filesystem";
import TouchFeedbackButton from "./TouchFeedbackButton";
import CustomAlertModal from "./CustomAlertModal";
import { Camera as CameraIcon, Image as GalleryIcon } from "lucide-react";
import { debugLog } from '../utils/logger.js';
import {
  validateImageFreshness,
  validateImageForEducation,
} from "../utils/imageValidator";

/**
 * Convert a local-time Date to an ISO-8601 string that PRESERVES the device's
 * local time by appending the actual UTC offset (e.g. "+05:30").
 * This prevents .toISOString() from silently shifting the time to UTC.
 *
 * Example on IST (UTC+5:30) device:
 *   new Date("2026-03-25 07:30").toISOString()    → "2026-03-25T02:00:00.000Z"  ❌ wrong
 *   toLocalISOString(new Date("2026-03-25 07:30")) → "2026-03-25T07:30:00+05:30" ✅ correct
 */
function toLocalISOString(date) {
  const pad = (n) => String(n).padStart(2, "0");
  const offsetMin = -date.getTimezoneOffset(); // IST → +330 min
  const sign = offsetMin >= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMin);
  const tzStr = `${sign}${pad(Math.floor(absMin / 60))}:${pad(absMin % 60)}`;
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${tzStr}`
  );
}

const ImageUpload = forwardRef(
  (
    {
      onImageSelect,
      imagePreview,
      loading = false,
      loadingState = "analyzing",
      imageType = null,
      detectedFoodNames = [],
      onHelpClick,
      // Live education window from DB passed by App.js — null until fetched
      educationWindow = null,
    },
    ref,
  ) => {
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);
    const fallbackInputRef = useRef(null);

    // Use SVG icons only on iOS (emoji renders as ? in iOS WebView)
    const isIOS = Capacitor.getPlatform() === "ios";

    // Custom alert modal state
    const [alertModal, setAlertModal] = useState({
      isOpen: false,
      title: "",
      message: "",
      type: "info",
    });

    // Image preview modal state
    const [showImageModal, setShowImageModal] = useState(false);
    // True while the native camera / gallery picker dialog is open.
    // Disables both buttons to prevent a second dialog opening mid-session.
    const [cameraActive, setCameraActive] = useState(false);

    // Helper to convert base64 to File
    const base64ToFile = async (base64String, filename = "image.jpg") => {
      try {
        const dataUrl = base64String.startsWith("data:")
          ? base64String
          : `data:image/jpeg;base64,${base64String}`;
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        return new File([blob], filename, { type: "image/jpeg" });
      } catch (error) {
        console.error("Error converting base64 to file:", error);
        throw new Error("Failed to process image data");
      }
    };

    const handleFileChange = async (event) => {
      const file = event.target.files[0];
      if (file) {
        if (!file.type.startsWith("image/")) {
          setAlertModal({
            isOpen: true,
            title: "Invalid File",
            message: "Please select an image file",
            type: "error",
          });
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          setAlertModal({
            isOpen: true,
            title: "File Too Large",
            message: "Image size should be less than 10MB",
            type: "error",
          });
          return;
        }

        // 🚨 VALIDATE IMAGE FRESHNESS (Prevent proxy/old images)
        if (imageType === "education") {
          // Block upload if window hasn't loaded from DB yet
          if (!educationWindow) {
            setAlertModal({
              isOpen: true,
              title: "⏳ Loading",
              message:
                "Education schedule is still loading. Please try again in a moment.",
              type: "info",
            });
            event.target.value = "";
            return;
          }
          // Use education time window passed from App.js (fetched live from DB)
          const validation = await validateImageForEducation(
            file,
            educationWindow,
          );

          if (!validation.isValid) {
            setAlertModal({
              isOpen: true,
              title: validation.message || "Invalid Image",
              message: "Please use a photo taken today during education hours.",
              type: "error",
            });
            // Clear the input
            event.target.value = "";
            return;
          }

          debugLog("✅ Image validated:", validation.message);
          debugLog("📸 Image timestamp:", validation.imageTimestamp);

          // Pass both file and timestamp to parent
          // Fall back to file.lastModified if EXIF timestamp unavailable
          onImageSelect(
            file,
            validation.imageTimestamp ||
              toLocalISOString(new Date(file.lastModified)),
          );
          return;
        }

        // Non-education: use file.lastModified (reflects actual file creation time on web)
        onImageSelect(file, toLocalISOString(new Date(file.lastModified)));
      }
    };

    const triggerCamera = async () => {
      // Use Capacitor Camera for native platforms
      if (Capacitor.isNativePlatform()) {
        setCameraActive(true);
        try {
          const photo = await Camera.getPhoto({
            quality: 85,
            resultType: CameraResultType.Base64,
            source: CameraSource.Camera,
            allowEditing: false,
            correctOrientation: true,
            width: 1280,
            height: 1280,
          });

          if (photo.base64String) {
            const file = await base64ToFile(
              photo.base64String,
              `photo-${Date.now()}.jpg`,
            );

            // ── Extract EXIF capture time from Capacitor photo ──────────────
            // photo.exif.DateTimeOriginal = actual shutter time in LOCAL time
            // We must use this instead of new Date() (which is upload time, not capture time)
            let captureTimestamp = null;
            if (photo.exif) {
              const exifDateStr =
                photo.exif.DateTimeOriginal ||
                photo.exif.dateTimeOriginal ||
                photo.exif.DateTime ||
                photo.exif.dateTime;
              if (exifDateStr) {
                // EXIF format: "YYYY:MM:DD HH:MM:SS" → parse as local time
                const match = exifDateStr.match(
                  /^(\d{4}):(\d{2}):(\d{2})\s(\d{2}):(\d{2}):(\d{2})$/,
                );
                if (match) {
                  const [, yr, mo, dy, hr, mn, sc] = match.map(Number);
                  // Build as LOCAL time (month is 0-indexed)
                  const localDate = new Date(yr, mo - 1, dy, hr, mn, sc);
                  if (!isNaN(localDate.getTime())) {
                    captureTimestamp = toLocalISOString(localDate);
                    debugLog(
                      "📸 Camera EXIF capture time:",
                      captureTimestamp,
                    );
                  }
                }
              }
            }

            // Fall back to current time ONLY if EXIF is genuinely missing
            // (on native camera the photo is just taken, so now ≈ capture time)
            if (!captureTimestamp) {
              captureTimestamp = toLocalISOString(new Date());
              debugLog(
                "📸 No EXIF from camera, using current time:",
                captureTimestamp,
              );
            }

            onImageSelect(file, captureTimestamp);
          }
        } catch (err) {
          console.error("Camera capture failed:", err);
          // User cancelled or error - fall back to HTML input
          if (err.message !== "User cancelled photos app") {
            cameraInputRef.current?.click();
          }
        } finally {
          setCameraActive(false);
        }
      } else {
        cameraInputRef.current?.click();
      }
    };

    const triggerGallery = async () => {
      // Use Capacitor Camera for native platforms (more reliable for gallery)
      if (Capacitor.isNativePlatform()) {
        setCameraActive(true);
        try {
          const photo = await Camera.getPhoto({
            quality: 90,
            resultType: CameraResultType.Base64,
            source: CameraSource.Photos,
            allowEditing: false,
            correctOrientation: true,
            width: 1920,
            height: 1920,
          });

          if (photo.base64String) {
            const file = await base64ToFile(
              photo.base64String,
              `gallery-${Date.now()}.jpg`,
            );

            // 🚨 Native gallery: use Capacitor's photo.exif for reliable date check
            // (base64ToFile always gives lastModified=now, so file date is useless here)
            if (imageType === "education") {
              // Block upload if window hasn't loaded from DB yet
              if (!educationWindow) {
                setAlertModal({
                  isOpen: true,
                  title: "⏳ Loading",
                  message:
                    "Education schedule is still loading. Please try again in a moment.",
                  type: "info",
                });
                return;
              }
              // Use education time window passed from App.js (fetched live from DB)

              // Capacitor exposes EXIF via photo.exif — use it if available
              let photoDate = null;
              if (photo.exif) {
                const exifDateStr =
                  photo.exif.DateTimeOriginal ||
                  photo.exif.dateTimeOriginal ||
                  photo.exif.DateTime ||
                  photo.exif.dateTime;
                if (exifDateStr) {
                  // EXIF format: "YYYY:MM:DD HH:MM:SS" → convert to ISO
                  const iso = exifDateStr.replace(
                    /^(\d{4}):(\d{2}):(\d{2})/,
                    "$1-$2-$3",
                  );
                  const parsed = new Date(iso);
                  if (!isNaN(parsed.getTime())) photoDate = parsed;
                }
              }

              if (photoDate) {
                const now = new Date();
                const isSameDay =
                  photoDate.getFullYear() === now.getFullYear() &&
                  photoDate.getMonth() === now.getMonth() &&
                  photoDate.getDate() === now.getDate();

                if (!isSameDay) {
                  setAlertModal({
                    isOpen: true,
                    title: "Photo Not From Today",
                    message: `This photo was taken on ${photoDate.toLocaleDateString()}. Please take a FRESH photo today.`,
                    type: "error",
                  });
                  return;
                }

                const imageTimeStr = photoDate.toTimeString().substring(0, 8);
                if (
                  imageTimeStr < educationWindow.start ||
                  imageTimeStr > educationWindow.end
                ) {
                  setAlertModal({
                    isOpen: true,
                    title: "Outside Education Hours",
                    message: `Photo was taken outside education hours. Please take a photo during your education session.`,
                    type: "error",
                  });
                  return;
                }

                debugLog(
                  "Gallery image validated via EXIF:",
                  toLocalISOString(photoDate),
                );
                onImageSelect(file, toLocalISOString(photoDate));
                return;
              }

              // No EXIF from Capacitor — fall back to Filesystem.stat() for modification time
              debugLog(
                " No EXIF metadata, checking Filesystem.stat() for education image",
              );

              // Check if photo.path is available (might be missing for WhatsApp/screenshot images)
              if (!photo.path) {
                console.warn(
                  "⚠️ photo.path not available - likely WhatsApp/screenshot image",
                );
                setAlertModal({
                  isOpen: true,
                  title: "WhatsApp/Screenshot Not Allowed",
                  message: "Please use Camera to take a fresh photo.",
                  type: "error",
                });
                return;
              }

              try {
                const stat = await Filesystem.stat({ path: photo.path });
                const fileDate = new Date(stat.mtime);

                const now = new Date();
                const isSameDay =
                  fileDate.getFullYear() === now.getFullYear() &&
                  fileDate.getMonth() === now.getMonth() &&
                  fileDate.getDate() === now.getDate();

                if (!isSameDay) {
                  setAlertModal({
                    isOpen: true,
                    title: "Photo Not From Today",
                    message: `This photo was modified on ${fileDate.toLocaleDateString()}. Please take a FRESH photo today.`,
                    type: "error",
                  });
                  return;
                }

                const imageTimeStr = fileDate.toTimeString().substring(0, 8);
                if (
                  imageTimeStr < educationWindow.start ||
                  imageTimeStr > educationWindow.end
                ) {
                  setAlertModal({
                    isOpen: true,
                    title: "Outside Education Hours",
                    message: `Photo was modified outside education hours. Please take a photo during your education session.`,
                    type: "error",
                  });
                  return;
                }

                debugLog(
                  "✅ Education gallery image validated via Filesystem.stat:",
                  toLocalISOString(fileDate),
                );
                onImageSelect(file, toLocalISOString(fileDate));
                return;
              } catch (fsError) {
                console.error("❌ Filesystem.stat failed:", fsError);
                setAlertModal({
                  isOpen: true,
                  title: "Cannot Verify Image Date",
                  message: "Please use Camera to take a fresh photo.",
                  type: "error",
                });
                return;
              }
            }

            // Non-education native gallery: extract EXIF for accurate timestamp + validate same-day
            let galleryTimestamp = null;

            // Try EXIF first
            if (photo.exif) {
              const exifDateStr =
                photo.exif.DateTimeOriginal ||
                photo.exif.dateTimeOriginal ||
                photo.exif.DateTime ||
                photo.exif.dateTime;
              if (exifDateStr) {
                const iso = exifDateStr.replace(
                  /^(\d{4}):(\d{2}):(\d{2})/,
                  "$1-$2-$3",
                );
                const parsed = new Date(iso);
                if (!isNaN(parsed.getTime())) {
                  // Validate photo is from today
                  const now = new Date();
                  const isSameDay =
                    parsed.getFullYear() === now.getFullYear() &&
                    parsed.getMonth() === now.getMonth() &&
                    parsed.getDate() === now.getDate();

                  if (!isSameDay) {
                    setAlertModal({
                      isOpen: true,
                      title: "Photo Not From Today",
                      message: `This photo was taken on ${parsed.toLocaleDateString()}. Please use a FRESH photo taken today.`,
                      type: "error",
                    });
                    return;
                  }

                  galleryTimestamp = toLocalISOString(parsed);
                  debugLog(
                    "✅ Non-education gallery image validated via EXIF:",
                    galleryTimestamp,
                  );
                }
              }
            }

            // Fallback to Filesystem.stat() if EXIF is missing
            if (!galleryTimestamp) {
              debugLog(
                "⚠️ No EXIF metadata, checking Filesystem.stat() for non-education image",
              );

              // Check if photo.path is available (might be missing for WhatsApp/screenshot images)
              if (!photo.path) {
                console.warn(
                  "⚠️ photo.path not available - likely WhatsApp/screenshot image",
                );
                setAlertModal({
                  isOpen: true,
                  title: "WhatsApp/Screenshot Not Allowed",
                  message: "Please use Camera to take a fresh photo.",
                  type: "error",
                });
                return;
              }

              try {
                const stat = await Filesystem.stat({ path: photo.path });
                const fileDate = new Date(stat.mtime);

                const now = new Date();
                const isSameDay =
                  fileDate.getFullYear() === now.getFullYear() &&
                  fileDate.getMonth() === now.getMonth() &&
                  fileDate.getDate() === now.getDate();

                if (!isSameDay) {
                  setAlertModal({
                    isOpen: true,
                    title: "Photo Not From Today",
                    message: `This photo was modified on ${fileDate.toLocaleDateString()}. Please use a FRESH photo taken today.`,
                    type: "error",
                  });
                  return;
                }

                galleryTimestamp = toLocalISOString(fileDate);
                debugLog(
                  "✅ Non-education gallery image validated via Filesystem.stat:",
                  galleryTimestamp,
                );
              } catch (fsError) {
                console.error("❌ Filesystem.stat failed:", fsError);
                setAlertModal({
                  isOpen: true,
                  title: "Cannot Verify Image Date",
                  message: "Please use Camera to take a fresh photo.",
                  type: "error",
                });
                return;
              }
            }

            onImageSelect(file, galleryTimestamp);
          }
        } catch (err) {
          console.error("Gallery selection failed:", err);
          // User cancelled or error - fall back to HTML input
          if (err.message !== "User cancelled photos app") {
            galleryInputRef.current?.click();
          }
        } finally {
          setCameraActive(false);
        }
      } else {
        galleryInputRef.current?.click();
      }
    };

    // Expose reset method and openCamera to parent component
    useImperativeHandle(ref, () => ({
      resetInputs: () => {
        if (cameraInputRef.current) cameraInputRef.current.value = "";
        if (galleryInputRef.current) galleryInputRef.current.value = "";
        if (fallbackInputRef.current) fallbackInputRef.current.value = "";
      },
      // Called by App.js to auto-open the camera (same as tapping Take Photo)
      openCamera: () => triggerCamera(),
    }));

    // Taglines for loading overlay based on state and image type
    const getTaglines = () => {
      if (loadingState === "saving") {
        if (imageType === "weight") {
          return [
            "Saving your progress...",
            "Updating your wellness journey...",
            "Recording your achievement...",
            "Your transformation is being tracked...",
            "Almost there...",
          ];
        }
        if (imageType === "education") {
          return [
            "Logging your learning session...",
            "Recording your education time...",
            "Saving your study progress...",
            "Updating your education log...",
            "Almost done...",
          ];
        }
        return [
          "Saving your delicious meal...",
          "Recording your nutrition...",
          "Updating your food diary...",
          "Your healthy choice is being saved...",
          "Almost there...",
        ];
      }

      // When image type is not yet detected
      if (!imageType) {
        return [
          "Discovering what you've got...",
          "AI magic in progress...",
          "Smart detection underway...",
          "Let's see what we have here...",
          "Analyzing your image...",
        ];
      }

      if (imageType === "weight") {
        return [
          "Reading your scale...",
          "Tracking your body metrics...",
          "Calculating your progress...",
          "Measuring your transformation...",
          "Your wellness data is loading...",
        ];
      }

      if (imageType === "education") {
        return [
          "Detecting your learning session...",
          "Recognizing your study platform...",
          "Identifying your meeting...",
          "Logging your education time...",
          "Processing your study session...",
        ];
      }

      return [
        "Analyzing your delicious meal...",
        "Discovering ingredients...",
        "Calculating your nutrition...",
        "Breaking down macros & calories...",
        "Smart portion sizing...",
        "AI-powered food recognition...",
        "Your healthy choice matters...",
        "Nutrition facts loading...",
        "USDA database lookup...",
        "Creating your meal summary...",
      ];
    };

    const taglines = getTaglines();

    const [currentTaglineIndex, setCurrentTaglineIndex] = useState(0);

    // Reset tagline index when loading state or image type changes
    useEffect(() => {
      setCurrentTaglineIndex(0);
    }, [loadingState, imageType]);

    useEffect(() => {
      if (loading) {
        const interval = setInterval(() => {
          setCurrentTaglineIndex(
            (prevIndex) => (prevIndex + 1) % taglines.length,
          );
        }, 2500);
        return () => clearInterval(interval);
      }
    }, [loading, taglines.length, loadingState, imageType]);

    return (
      <>
        <div className="bg-white rounded-xl shadow-lg border-2 border-green-200 p-4 sm:p-6 lg:p-8">
          {/* Camera input */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
          {/* Gallery input */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          {/* Fallback input */}
          <input
            ref={fallbackInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          {imagePreview ? (
            <div className="space-y-3 sm:space-y-4">
              <div className="relative">
                {/* Image - Always Visible */}
                <img
                  src={imagePreview}
                  alt="Selected food"
                  onClick={() => setShowImageModal(true)}
                  className="w-full h-48 sm:h-56 md:h-64 lg:h-72 object-cover rounded-lg border-2 border-green-300 cursor-pointer hover:border-green-400 transition-all duration-200"
                  title="Click to view full size"
                />

                {/* Non-Blocking Loading Indicator - Top Right Corner */}
                {loading && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-gradient-to-br from-green-500 to-green-600 text-white px-2 py-1.5 sm:px-3 sm:py-2 rounded-full shadow-lg flex items-center gap-1.5 sm:gap-2"
                  >
                    <div className="relative w-3 h-3 sm:w-4 sm:h-4">
                      <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    </div>
                    <span className="text-[10px] sm:text-xs font-semibold">
                      {loadingState === "saving" ? "Saving..." : "Analyzing..."}
                    </span>
                  </motion.div>
                )}

                {/* Success Badge - When Analysis Complete */}
                {!loading && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-green-500 text-white px-2 py-1.5 sm:px-3 sm:py-2 rounded-full text-[10px] sm:text-xs font-semibold shadow-lg flex items-center gap-1"
                  >
                    <span>✓</span>
                    <span>Ready</span>
                  </motion.div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <TouchFeedbackButton
                  onClick={triggerCamera}
                  disabled={loading || cameraActive}
                  className="bg-blue-100 text-blue-700 py-2.5 px-3 sm:py-3 sm:px-4 rounded-lg text-sm sm:text-base font-medium hover:bg-blue-200 transition-colors duration-200 border border-blue-300 flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  ariaLabel="Take Photo"
                >
                  {isIOS ? (
                    <CameraIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  ) : (
                    <span className="text-base sm:text-lg">📷</span>
                  )}
                  <span className="hidden xs:inline sm:inline">Take Photo</span>
                  <span className="xs:hidden sm:hidden">Photo</span>
                </TouchFeedbackButton>
                <TouchFeedbackButton
                  onClick={triggerGallery}
                  disabled={loading || cameraActive}
                  className="bg-green-100 text-green-700 py-2.5 px-3 sm:py-3 sm:px-4 rounded-lg text-sm sm:text-base font-medium hover:bg-green-200 transition-colors duration-200 border border-green-300 flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  ariaLabel="From Gallery"
                >
                  {isIOS ? (
                    <GalleryIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  ) : (
                    <span className="text-base sm:text-lg">🖼️</span>
                  )}
                  <span className="hidden xs:inline sm:inline">Gallery</span>
                  <span className="xs:hidden sm:hidden">Gallery</span>
                </TouchFeedbackButton>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full">
              <div className="border-2 border-dashed border-green-300 rounded-lg p-4 sm:p-6 md:p-8 hover:border-green-400 transition-colors duration-200 text-center w-full">
                <div className="flex justify-center mb-2 sm:mb-4">
                  {/* 🍎 */}
                  <div className="text-3xl sm:text-5xl md:text-6xl"></div>
                </div>
                <h3 className="text-sm sm:text-base md:text-lg font-semibold text-green-700 mb-1.5 sm:mb-2 text-center">
                  {" "}
                </h3>
                {/* Take photo of your Food • Weighing scale • Meeting screenshot• Smartwatch */}
                <p className="text-gray-600 mb-3 sm:mb-6 text-[11px] sm:text-sm text-center"></p>
                {/* Take a photo with camera or select from gallery */}
                <div className="flex gap-2 sm:gap-4 mb-2.5 sm:mb-4 w-full">
                  <TouchFeedbackButton
                    onClick={triggerCamera}
                    disabled={loading || cameraActive}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-2 sm:py-3 sm:px-6 rounded-lg text-xs sm:text-base font-semibold shadow-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-w-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    ariaLabel="Take Photo"
                  >
                    {isIOS ? (
                      <CameraIcon className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                    ) : (
                      <span className="text-xl sm:text-2xl">📷</span>
                    )}
                    <span className="text-xs sm:text-base leading-tight whitespace-nowrap">
                      Take Photo
                    </span>
                  </TouchFeedbackButton>
                  <TouchFeedbackButton
                    onClick={triggerGallery}
                    disabled={loading || cameraActive}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-2 sm:py-3 sm:px-6 rounded-lg text-xs sm:text-base font-semibold shadow-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-w-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    ariaLabel="From Gallery"
                  >
                    {isIOS ? (
                      <GalleryIcon className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                    ) : (
                      <span className="text-xl sm:text-2xl">🖼️</span>
                    )}
                    <span className="text-xs sm:text-base leading-tight whitespace-nowrap">
                      From Gallery
                    </span>
                  </TouchFeedbackButton>
                </div>

                <div className="text-[10px] sm:text-xs text-gray-500 text-center mt-2">
                  {/* Camera works best on mobile devices • Max 10MB •{' '} */}
                  <button
                    onClick={onHelpClick}
                    className="text-red-500 font-normal hover:text-red-600 focus:outline-none underline"
                  >
                    Help
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Custom Alert Modal */}
          <CustomAlertModal
            isOpen={alertModal.isOpen}
            onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
            title={alertModal.title}
            message={alertModal.message}
            type={alertModal.type}
          />

          {/* Full Screen Image Preview Modal */}
          <AnimatePresence>
            {showImageModal && imagePreview && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowImageModal(false)}
                className="fixed inset-0 bg-black bg-opacity-90 z-[10000] flex items-center justify-center p-4"
              >
                {/* Close Button */}
                <button
                  onClick={() => setShowImageModal(false)}
                  className="absolute top-4 right-4 bg-red-400 hover:bg-red-500 active:bg-red-800 text-white rounded-full p-3 transition-all duration-200 z-[10001] shadow-lg"
                  aria-label="Close"
                >
                  <svg
                    className="w-7 h-7"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>

                {/* Full Size Image */}
                <motion.img
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.9 }}
                  onClick={(e) => e.stopPropagation()}
                  src={imagePreview}
                  alt="Full size preview"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </>
    );
  },
);

ImageUpload.displayName = "ImageUpload";

export default ImageUpload;
