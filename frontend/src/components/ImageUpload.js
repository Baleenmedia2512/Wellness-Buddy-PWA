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
import { validateImageFreshness, validateImageForEducation } from "../utils/imageValidator";

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
    },
    ref,
  ) => {
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);
    const fallbackInputRef = useRef(null);
    
    // Custom alert modal state
    const [alertModal, setAlertModal] = useState({
      isOpen: false,
      title: '',
      message: '',
      type: 'info'
    });

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
            title: 'Invalid File',
            message: 'Please select an image file',
            type: 'error'
          });
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          setAlertModal({
            isOpen: true,
            title: 'File Too Large',
            message: 'Image size should be less than 10MB',
            type: 'error'
          });
          return;
        }
        
        // 🚨 VALIDATE IMAGE FRESHNESS (Prevent proxy/old images)
        if (imageType === "education") {
          // Get education time window (default: 5:00 AM - 11:59 PM)
          const educationWindow = { start: '05:00:00', end: '23:59:00' };
          const validation = await validateImageForEducation(file, educationWindow);
          
          if (!validation.isValid) {
            setAlertModal({
              isOpen: true,
              title: '🚨 PROXY ALERT',
              message: validation.message,
              type: 'error'
            });
            // Clear the input
            event.target.value = "";
            return;
          }
          
          console.log("✅ Image validated:", validation.message);
          console.log("📸 Image timestamp:", validation.imageTimestamp);
          
          // Pass both file and timestamp to parent
          // Fall back to file.lastModified if EXIF timestamp unavailable
          onImageSelect(file, validation.imageTimestamp || new Date(file.lastModified).toISOString());
          return;
        }
        
        // Non-education: use file.lastModified (reflects actual file creation time on web)
        onImageSelect(file, new Date(file.lastModified).toISOString());
      }
    };

    const triggerCamera = async () => {
      // Use Capacitor Camera for native platforms
      if (Capacitor.isNativePlatform()) {
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
            
            // ✅ Native camera = user is taking the photo RIGHT NOW — always fresh
            if (imageType === "education") {
              onImageSelect(file, new Date().toISOString());
              return;
            }
            
            onImageSelect(file, new Date().toISOString());
          }
        } catch (err) {
          console.error("Camera capture failed:", err);
          // User cancelled or error - fall back to HTML input
          if (err.message !== "User cancelled photos app") {
            cameraInputRef.current?.click();
          }
        }
      } else {
        cameraInputRef.current?.click();
      }
    };

    const triggerGallery = async () => {
      // Use Capacitor Camera for native platforms (more reliable for gallery)
      if (Capacitor.isNativePlatform()) {
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
              const educationWindow = { start: '05:00:00', end: '23:59:00' };
              
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
                  const iso = exifDateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
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
                    title: '🚨 PROXY ALERT',
                    message: `⚠️ This photo was taken on ${photoDate.toLocaleDateString()}. Please take a FRESH photo today during education hours.`,
                    type: 'error'
                  });
                  return;
                }
                
                const imageTimeStr = photoDate.toTimeString().substring(0, 8);
                if (imageTimeStr < educationWindow.start || imageTimeStr > educationWindow.end) {
                  setAlertModal({
                    isOpen: true,
                    title: '🚨 PROXY ALERT',
                    message: `⚠️ Photo taken at ${imageTimeStr}, outside education hours (${educationWindow.start} – ${educationWindow.end}).`,
                    type: 'error'
                  });
                  return;
                }
                
                console.log('✅ Gallery image validated via EXIF:', photoDate.toISOString());
                onImageSelect(file, photoDate.toISOString());
                return;
              }
              
              // No EXIF from Capacitor — fall back to Filesystem.stat() for modification time
              console.log('⚠️ No EXIF metadata, using Filesystem.stat() for education image');
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
                    title: '🚨 PROXY ALERT',
                    message: `⚠️ This photo was modified on ${fileDate.toLocaleDateString()}. Please take a FRESH photo today during education hours.`,
                    type: 'error'
                  });
                  return;
                }
                
                const imageTimeStr = fileDate.toTimeString().substring(0, 8);
                if (imageTimeStr < educationWindow.start || imageTimeStr > educationWindow.end) {
                  setAlertModal({
                    isOpen: true,
                    title: '🚨 PROXY ALERT',
                    message: `⚠️ Photo modified at ${imageTimeStr}, outside education hours (${educationWindow.start} – ${educationWindow.end}).`,
                    type: 'error'
                  });
                  return;
                }
                
                console.log('✅ Education gallery image validated via Filesystem.stat:', fileDate.toISOString());
                onImageSelect(file, fileDate.toISOString());
                return;
              } catch (fsError) {
                console.error('❌ Filesystem.stat failed, falling back to byte parser:', fsError);
                // Last resort: use byte-level EXIF parser
                const validation = await validateImageForEducation(file, educationWindow);
                if (!validation.isValid) {
                  setAlertModal({ isOpen: true, title: '🚨 PROXY ALERT', message: validation.message, type: 'error' });
                  return;
                }
                onImageSelect(file, validation.imageTimestamp);
                return;
              }
            }
            
            // Non-education native gallery: extract EXIF for accurate timestamp + validate same-day
            let galleryTimestamp = null;
            
            // Try EXIF first
            if (photo.exif) {
              const exifDateStr =
                photo.exif.DateTimeOriginal || photo.exif.dateTimeOriginal ||
                photo.exif.DateTime || photo.exif.dateTime;
              if (exifDateStr) {
                const iso = exifDateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
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
                      title: '🚨 PROXY ALERT',
                      message: `⚠️ This photo was taken on ${parsed.toLocaleDateString()}. Please use a FRESH photo taken today.`,
                      type: 'error'
                    });
                    return;
                  }
                  
                  galleryTimestamp = parsed.toISOString();
                  console.log('✅ Non-education gallery image validated via EXIF:', galleryTimestamp);
                }
              }
            }
            
            // Fallback to Filesystem.stat() if EXIF is missing
            if (!galleryTimestamp) {
              console.log('⚠️ No EXIF metadata, using Filesystem.stat() for non-education image');
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
                    title: '🚨 PROXY ALERT',
                    message: `⚠️ This photo was modified on ${fileDate.toLocaleDateString()}. Please use a FRESH photo taken today.`,
                    type: 'error'
                  });
                  return;
                }
                
                galleryTimestamp = fileDate.toISOString();
                console.log('✅ Non-education gallery image validated via Filesystem.stat:', galleryTimestamp);
              } catch (fsError) {
                console.error('❌ Filesystem.stat failed:', fsError);
                // Last resort: use current time
                galleryTimestamp = new Date().toISOString();
                console.log('⚠️ Using current time as fallback');
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
        }
      } else {
        galleryInputRef.current?.click();
      }
    };

    // Expose reset method to parent component
    useImperativeHandle(ref, () => ({
      resetInputs: () => {
        if (cameraInputRef.current) cameraInputRef.current.value = "";
        if (galleryInputRef.current) galleryInputRef.current.value = "";
        if (fallbackInputRef.current) fallbackInputRef.current.value = "";
      },
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
                className="w-full h-48 sm:h-56 md:h-64 lg:h-72 object-cover rounded-lg border-2 border-green-300"
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
                disabled={loading}
                className="bg-blue-100 text-blue-700 py-2.5 px-3 sm:py-3 sm:px-4 rounded-lg text-sm sm:text-base font-medium hover:bg-blue-200 transition-colors duration-200 border border-blue-300 flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                ariaLabel="Take Photo"
              >
                <span className="text-base sm:text-lg">📷</span>
                <span className="hidden xs:inline sm:inline">Take Photo</span>
                <span className="xs:hidden sm:hidden">Photo</span>
              </TouchFeedbackButton>
              <TouchFeedbackButton
                onClick={triggerGallery}
                disabled={loading}
                className="bg-green-100 text-green-700 py-2.5 px-3 sm:py-3 sm:px-4 rounded-lg text-sm sm:text-base font-medium hover:bg-green-200 transition-colors duration-200 border border-green-300 flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                ariaLabel="From Gallery"
              >
                <span className="text-base sm:text-lg">🖼️</span>
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
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-2 sm:py-3 sm:px-6 rounded-lg text-xs sm:text-base font-semibold shadow-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-w-0"
                  ariaLabel="Take Photo"
                >
                  <span className="text-xl sm:text-2xl">📷</span>
                  <span className="text-xs sm:text-base leading-tight whitespace-nowrap">
                    Take Photo
                  </span>
                </TouchFeedbackButton>
                <TouchFeedbackButton
                  onClick={triggerGallery}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-2 sm:py-3 sm:px-6 rounded-lg text-xs sm:text-base font-semibold shadow-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-w-0"
                  ariaLabel="From Gallery"
                >
                  <span className="text-xl sm:text-2xl">🖼️</span>
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
      </div>
      </>
    );
  },
);

ImageUpload.displayName = "ImageUpload";

export default ImageUpload;
