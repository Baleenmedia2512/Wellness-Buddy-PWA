// src/components/MandatoryProfilePictureModal.js
import React, { useState, useRef } from "react";
import { Camera, Upload, AlertCircle } from "lucide-react";

/**
 * MandatoryProfilePictureModal
 * Blocking modal that forces users to upload a profile picture
 * Cannot be closed until a valid image is uploaded
 */
const MandatoryProfilePictureModal = ({ user, apiBaseUrl, onComplete }) => {
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Handle profile image selection
  const handleImageSelect = (file) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB");
      return;
    }

    // Read and compress image
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress image to max 800x800 and reduce quality
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const maxSize = 800;

        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64 with reduced quality (0.7 = 70% quality)
        const base64String = canvas.toDataURL("image/jpeg", 0.7);

        // Check compressed size
        const sizeInBytes = (base64String.length * 3) / 4;
        const sizeInMB = sizeInBytes / (1024 * 1024);
        console.log(
          `📸 Image compressed: ${(file.size / (1024 * 1024)).toFixed(
            2,
          )}MB → ${sizeInMB.toFixed(2)}MB`,
        );

        setProfileImage(base64String);
        setProfileImagePreview(base64String);
        setError("");
      };
      img.onerror = () => {
        setError("Failed to load image file");
      };
      img.src = event.target.result;
    };
    reader.onerror = () => {
      setError("Failed to read image file");
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    handleImageSelect(file);
  };

  const handleUpload = async () => {
    if (!profileImage) {
      setError("Please select an image first");
      return;
    }

    try {
      setError("");
      setIsSaving(true);

      const response = await fetch(`${apiBaseUrl}/api/update-user-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          profileImage: profileImage,
        }),
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("❌ Non-JSON response:", text);
        throw new Error(
          "Server returned an error. Please try with a smaller image.",
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Failed to upload profile picture",
        );
      }

      if (data.success) {
        console.log("✅ Profile picture uploaded successfully");
        // Call onComplete to allow user to proceed
        onComplete();
      } else {
        throw new Error(data.message || "Failed to upload profile picture");
      }
    } catch (err) {
      console.error("❌ Error uploading profile picture:", err);
      setError(err.message || "Failed to upload profile picture");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ zIndex: 350 }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-green-500 to-green-600 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Profile Picture Required
              </h2>
              <p className="text-sm text-green-50">
                Please upload your photo to continue
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Alert Message */}
          <div className="flex items-start space-x-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                Profile picture is mandatory
              </p>
              <p className="text-xs text-amber-700 mt-1">
              </p>
            </div>
          </div>

          {/* Image Preview */}
          {profileImagePreview ? (
            <div className="flex justify-center">
              <div className="relative w-40 h-40 rounded-full border-4 border-green-500 overflow-hidden">
                <img
                  src={profileImagePreview}
                  alt="Profile Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-40 h-40 rounded-full border-4 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No image selected</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Upload Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {/* Hidden inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Camera Button */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={isSaving}
              className="flex flex-col items-center justify-center p-4 border-2 border-blue-300 rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="w-8 h-8 text-blue-600 mb-2" />
              <span className="text-sm font-medium text-blue-700">
                Take Photo
              </span>
            </button>

            {/* Gallery Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isSaving}
              className="flex flex-col items-center justify-center p-4 border-2 border-green-300 rounded-xl hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-8 h-8 text-green-600 mb-2" />
              <span className="text-sm font-medium text-green-700">
                Upload Photo
              </span>
            </button>
          </div>

          {/* Save Button */}
          <button
            onClick={handleUpload}
            disabled={!profileImage || isSaving}
            className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span>Save & Continue</span>
              </>
            )}
          </button>

          <p className="text-xs text-center text-gray-500">
            You cannot proceed without uploading a profile picture
          </p>
        </div>
      </div>
    </div>
  );
};

export default MandatoryProfilePictureModal;
