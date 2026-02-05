// src\components\ImageUpload.js
import React, { forwardRef, useRef, useState, useEffect, useImperativeHandle } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import TouchFeedbackButton from './TouchFeedbackButton';

const ImageUpload = forwardRef(({ onImageSelect, imagePreview, loading = false, loadingState = 'analyzing', imageType = null, detectedFoodNames = [] }, ref) => {
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const fallbackInputRef = useRef(null);

  // Helper to convert base64 to File
  const base64ToFile = async (base64String, filename = 'image.jpg') => {
    try {
      const dataUrl = base64String.startsWith('data:') 
        ? base64String 
        : `data:image/jpeg;base64,${base64String}`;
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      return new File([blob], filename, { type: 'image/jpeg' });
    } catch (error) {
      console.error('Error converting base64 to file:', error);
      throw new Error('Failed to process image data');
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('Image size should be less than 10MB');
        return;
      }
      onImageSelect(file);
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
          height: 1280
        });

        if (photo.base64String) {
          const file = await base64ToFile(photo.base64String, `photo-${Date.now()}.jpg`);
          onImageSelect(file);
        }
      } catch (err) {
        console.error('Camera capture failed:', err);
        // User cancelled or error - fall back to HTML input
        if (err.message !== 'User cancelled photos app') {
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
          height: 1920
        });

        if (photo.base64String) {
          const file = await base64ToFile(photo.base64String, `gallery-${Date.now()}.jpg`);
          onImageSelect(file);
        }
      } catch (err) {
        console.error('Gallery selection failed:', err);
        // User cancelled or error - fall back to HTML input
        if (err.message !== 'User cancelled photos app') {
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
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      if (fallbackInputRef.current) fallbackInputRef.current.value = '';
    }
  }));

  // Taglines for loading overlay based on state and image type
  const getTaglines = () => {
    if (loadingState === 'saving') {
      if (imageType === 'weight') {
        return [
          "Saving your progress...",
          "Updating your wellness journey...",
          "Recording your achievement...",
          "Your transformation is being tracked...",
          "Almost there..."
        ];
      }
      if (imageType === 'education') {
        return [
          "Logging your learning session...",
          "Recording your education time...",
          "Saving your study progress...",
          "Updating your education log...",
          "Almost done..."
        ];
      }
      return [
        "Saving your delicious meal...",
        "Recording your nutrition...",
        "Updating your food diary...",
        "Your healthy choice is being saved...",
        "Almost there..."
      ];
    }
    
    // When image type is not yet detected
    if (!imageType) {
      return [
        "Discovering what you've got...",
        "AI magic in progress...",
        "Smart detection underway...",
        "Let's see what we have here...",
        "Analyzing your image..."
      ];
    }
    
    if (imageType === 'weight') {
      return [
        "Reading your scale...",
        "Tracking your body metrics...",
        "Calculating your progress...",
        "Measuring your transformation...",
        "Your wellness data is loading..."
      ];
    }
    
    if (imageType === 'education') {
      return [
        "Detecting your learning session...",
        "Recognizing your study platform...",
        "Identifying your meeting...",
        "Logging your education time...",
        "Processing your study session..."
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
      "Creating your meal summary..."
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
        setCurrentTaglineIndex((prevIndex) => (prevIndex + 1) % taglines.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [loading, taglines.length, loadingState, imageType]);

  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-green-200 p-6">
      {/* Camera input */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
      {/* Gallery input */}
      <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      {/* Fallback input */}
      <input ref={fallbackInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />

      {imagePreview ? (
        <div className="space-y-4">
          <div className="relative">
            <img src={imagePreview} alt="Selected food" className="w-full h-64 object-cover rounded-lg border-2 border-green-300" />

            {/* Loading Overlay */}
            {loading && (
              <div className="absolute inset-0 rounded-lg overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-black/30 to-black/40 backdrop-blur-md"></div>
                <div className="absolute inset-0 bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg">
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-50"></div>

                  <div className="absolute inset-0 flex items-center justify-center p-6">
                    <div className="text-center">
                      {/* Icon based on loading state */}
                      <div className="relative w-14 h-14 mx-auto mb-6">
                        {loadingState === 'saving' ? (
                          <>
                            <div className="absolute inset-0 rounded-full bg-green-500/30 backdrop-blur-sm"></div>
                            <div className="absolute inset-0 rounded-full border-2 border-green-400/50"></div>
                            <div className="absolute inset-0 rounded-full border-2 border-green-400 border-t-transparent animate-spin"></div>
                          </>
                        ) : imageType === 'weight' ? (
                          <>
                            <div className="absolute inset-0 rounded-full bg-purple-500/30 backdrop-blur-sm"></div>
                            <div className="absolute inset-0 rounded-full border-2 border-purple-400/50"></div>
                            <div className="absolute inset-0 rounded-full border-2 border-purple-400 border-t-transparent animate-spin"></div>
                          </>
                        ) : (
                          <>
                            <div className="absolute inset-0 rounded-full bg-white/20 backdrop-blur-sm"></div>
                            <div className="absolute inset-0 rounded-full border-2 border-white/30"></div>
                            <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                          </>
                        )}
                      </div>

                      {/* Animated Taglines */}
                      <div className="relative h-16 flex items-center justify-center">
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={currentTaglineIndex}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.5 }}
                            className="text-sm text-white/80 leading-relaxed drop-shadow-md"
                          >
                            {taglines[currentTaglineIndex]}
                          </motion.p>
                        </AnimatePresence>
                      </div>

                      {/* AI Detected Food Names - Show during analyzing phase for food images */}
                      {loadingState === 'analyzing' && imageType === 'food' && detectedFoodNames.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                          className="mt-4 bg-white/20 backdrop-blur-md rounded-lg p-3 border border-white/30"
                        >
                          <p className="text-xs text-white/70 mb-2 font-semibold">🤖 AI Detected:</p>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {detectedFoodNames.map((name, index) => (
                              <motion.span
                                key={index}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="bg-green-500/80 text-white text-xs px-3 py-1 rounded-full font-medium shadow-lg"
                              >
                                {name}
                              </motion.span>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      <div className="flex justify-center space-x-2 mt-6">
                        <div className="w-2 h-2 bg-white/60 backdrop-blur-sm rounded-full animate-bounce shadow-lg"></div>
                        <div className="w-2 h-2 bg-white/60 backdrop-blur-sm rounded-full animate-bounce shadow-lg" style={{ animationDelay: '0.15s' }}></div>
                        <div className="w-2 h-2 bg-white/60 backdrop-blur-sm rounded-full animate-bounce shadow-lg" style={{ animationDelay: '0.3s' }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-white/5 to-transparent rounded-b-lg"></div>
                </div>
              </div>
            )}

            {!loading && (
              <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                ✓ Ready
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TouchFeedbackButton
              onClick={triggerCamera}
              disabled={loading}
              className="bg-blue-100 text-blue-700 py-3 px-4 rounded-lg font-medium hover:bg-blue-200 transition-colors duration-200 border border-blue-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              ariaLabel="Take Photo"
            >
              📷 Take Photo
            </TouchFeedbackButton>
            <TouchFeedbackButton
              onClick={triggerGallery}
              disabled={loading}
              className="bg-green-100 text-green-700 py-3 px-4 rounded-lg font-medium hover:bg-green-200 transition-colors duration-200 border border-green-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              ariaLabel="From Gallery"
            >
              🖼️ From Gallery
            </TouchFeedbackButton>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="border-2 border-dashed border-green-300 rounded-lg p-8 hover:border-green-400 transition-colors duration-200">
            <div className="text-6xl mb-4">🍎</div>
            <h3 className="text-lg font-semibold text-green-700 mb-2">Upload Food Or Weight Photo</h3>
            <p className="text-gray-600 mb-4 text-sm">Take a photo with camera or select from gallery</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TouchFeedbackButton
                onClick={triggerCamera}
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-6 rounded-lg font-semibold shadow-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 flex items-center justify-center gap-2"
                ariaLabel="Take Photo"
              >
                📷 Take Photo
              </TouchFeedbackButton>
              <TouchFeedbackButton
                onClick={triggerGallery}
                className="bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-6 rounded-lg font-semibold shadow-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 flex items-center justify-center gap-2"
                ariaLabel="From Gallery"
              >
                🖼️ From Gallery
              </TouchFeedbackButton>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Camera works best on mobile devices • Max 10MB
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ImageUpload.displayName = 'ImageUpload';

export default ImageUpload;
