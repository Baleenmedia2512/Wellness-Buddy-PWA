// src\components\ImageUpload.js
import React, { forwardRef, useRef, useState, useEffect, useImperativeHandle } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ImageUpload = forwardRef(({ onImageSelect, imagePreview, loading = false }, ref) => {
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const fallbackInputRef = useRef(null);

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

  const triggerCamera = () => {
    cameraInputRef.current?.click();
  };

  const triggerGallery = () => {
    galleryInputRef.current?.click();
  };

  // Expose reset method to parent component
  useImperativeHandle(ref, () => ({
    resetInputs: () => {
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      if (fallbackInputRef.current) fallbackInputRef.current.value = '';
    }
  }));

  // Taglines for loading overlay
  const taglines = [
    "Scanning your meal...",
    "Crunching the numbers...",
    "Serving up nutrition facts...",
    "Analyzing delicious details...",
    "Counting every calorie...",
    "Identifying ingredients...",
    "Plating your nutrition insights...",
    "Decoding your dish...",
    "Looking deeper into your food...",
    "Cooking up your results..."
  ];

  const [currentTaglineIndex, setCurrentTaglineIndex] = useState(0);

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setCurrentTaglineIndex((prevIndex) => (prevIndex + 1) % taglines.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [loading]);

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
                      <div className="relative w-12 h-12 mx-auto mb-6">
                        <div className="absolute inset-0 rounded-full bg-white/20 backdrop-blur-sm"></div>
                        <div className="absolute inset-0 rounded-full border-2 border-white/30"></div>
                        <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
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
            <button
              onClick={triggerCamera}
              disabled={loading}
              className="bg-blue-100 text-blue-700 py-3 px-4 rounded-lg font-medium hover:bg-blue-200 transition-colors duration-200 border border-blue-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📷 Take Photo
            </button>
            <button
              onClick={triggerGallery}
              disabled={loading}
              className="bg-green-100 text-green-700 py-3 px-4 rounded-lg font-medium hover:bg-green-200 transition-colors duration-200 border border-green-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🖼️ From Gallery
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="border-2 border-dashed border-green-300 rounded-lg p-8 hover:border-green-400 transition-colors duration-200">
            <div className="text-6xl mb-4">🍎</div>
            <h3 className="text-lg font-semibold text-green-700 mb-2">Upload Food Or Weight Photo</h3>
            <p className="text-gray-600 mb-4 text-sm">Take a photo with camera or select from gallery</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={triggerCamera}
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-6 rounded-lg font-semibold shadow-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 flex items-center justify-center gap-2"
              >
                📷 Take Photo
              </button>
              <button
                onClick={triggerGallery}
                className="bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-6 rounded-lg font-semibold shadow-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 flex items-center justify-center gap-2"
              >
                🖼️ From Gallery
              </button>
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
