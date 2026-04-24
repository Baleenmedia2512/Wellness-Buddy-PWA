// src/components/MandatoryProfilePictureModal.js
import React, { useState, useRef, useCallback } from "react";
import Cropper from "react-easy-crop";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Camera, Upload, AlertCircle, Clock, CheckCircle, XCircle, Loader, Crop, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";

/** Crop a canvas region supporting rotation and flip */
const getCroppedImg = (imageSrc, pixelCrop, rotation = 0, flip = { h: false, v: false }) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = Math.max(img.width, img.height) * 2;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.translate(size / 2, size / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flip.h ? -1 : 1, flip.v ? -1 : 1);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const out = document.createElement("canvas");
      const outSize = Math.min(pixelCrop.width, pixelCrop.height);
      out.width = outSize;
      out.height = outSize;
      const outCtx = out.getContext("2d");
      outCtx.drawImage(
        canvas,
        pixelCrop.x + (size / 2 - img.width / 2),
        pixelCrop.y + (size / 2 - img.height / 2),
        pixelCrop.width,
        pixelCrop.height,
        0, 0, outSize, outSize
      );
      resolve(out.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
};

/**
 * MandatoryProfilePictureModal
 * Blocking modal that forces users to upload a profile picture
 * Cannot be closed until a valid image is uploaded
 */
const MAX_SNOOZE_ATTEMPTS = 5;

const MandatoryProfilePictureModal = ({ user, apiBaseUrl, onComplete, onRemindLater }) => {
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // faceStatus: "idle" | "detecting" | "face_found" | "no_face" | "detection_error"
  const [faceStatus, setFaceStatus] = useState("idle");
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Crop state
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flip] = useState({ h: false, v: false });
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // Read snooze attempt count from localStorage
  const userEmail = user?.email || user?.Email || "";
  const snoozeCountKey = "profilePicSnoozeCount_" + userEmail;
  const snoozeCount = userEmail ? parseInt(localStorage.getItem(snoozeCountKey) || "0", 10) : 0;
  const canSnooze = onRemindLater && snoozeCount < MAX_SNOOZE_ATTEMPTS;

  // Call Gemini directly (client-side) for face detection
  const detectFace = useCallback(async (base64String) => {
    setFaceStatus("detecting");
    try {
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("⚠️ [Face Detection] REACT_APP_GEMINI_API_KEY not set, skipping");
        setFaceStatus("detection_error");
        return;
      }

      const mimeMatch = base64String.match(/^data:(image\/[a-zA-Z]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const base64Data = base64String.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

      const result = await model.generateContent([
        { inlineData: { mimeType, data: base64Data } },
        "Does this image contain a clear, visible human face? Answer with only 'yes' or 'no'.",
      ]);

      const text = result.response.text().trim().toLowerCase();
      const hasFace = text.startsWith("yes");
      console.log(`✅ [Face Detection] Result: ${hasFace ? "face found" : "no face"} (raw: "${text}")`);
      setFaceStatus(hasFace ? "face_found" : "no_face");
    } catch (err) {
      console.error("❌ [Face Detection] Failed:", err.message);
      setFaceStatus("detection_error");
    }
  }, []);

  // Handle profile image selection — opens cropper
  const handleImageSelect = (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setRawImageSrc(event.target.result);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);

      setShowCropper(true);
      setError("");
    };
    reader.onerror = () => setError("Failed to read image file");
    reader.readAsDataURL(file);
  };

  // Called when user confirms the crop
  const handleCropConfirm = useCallback(async () => {
    if (!rawImageSrc || !croppedAreaPixels) return;
    try {
      const cropped = await getCroppedImg(rawImageSrc, croppedAreaPixels, rotation, flip);
      setProfileImage(cropped);
      setProfileImagePreview(cropped);
      setShowCropper(false);
      setFaceStatus("idle");
      setError("");
      detectFace(cropped);
    } catch (err) {
      setError("Failed to crop image. Please try again.");
    }
  }, [rawImageSrc, croppedAreaPixels, rotation, flip, detectFace]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    handleImageSelect(file);
  };

  const handleUpload = async () => {
    if (!profileImage) {
      setError("Please select an image first");
      return;
    }

    if (faceStatus === "detecting") {
      setError("Please wait while we verify your photo...");
      return;
    }

    if (faceStatus === "no_face") {
      setError("No face detected. Please upload a clear photo of your face.");
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
        // Call onComplete with the uploaded image data for immediate UI update
        onComplete(profileImage);
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

      {/* ── Professional Crop Overlay ──────────────────────────────── */}
      {showCropper && rawImageSrc && (
        <div className="absolute inset-0 flex flex-col bg-black" style={{ zIndex: 360 }}>

          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-4 bg-black/90">
            <button
              onClick={() => { setShowCropper(false); setRawImageSrc(null); }}
              className="text-white/70 hover:text-white text-sm font-medium px-3 py-1.5 rounded-lg border border-white/20"
            >Cancel</button>
            <span className="text-white font-semibold text-base tracking-wide">Crop Photo</span>
            <button
              onClick={handleCropConfirm}
              className="text-white text-sm font-semibold px-4 py-1.5 rounded-lg bg-green-500 hover:bg-green-400"
            >Done</button>
          </div>

          {/* Cropper canvas */}
          <div className="relative flex-1">
            <Cropper
              image={rawImageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="round"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
              style={{ containerStyle: { background: "#111" } }}
            />
          </div>

          {/* Controls panel */}
          <div className="bg-black/90 px-4 pt-3 pb-safe-6 space-y-3" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

            {/* Zoom row */}
            <div className="flex items-center gap-2">
              <ZoomOut className="w-4 h-4 text-white/60 flex-shrink-0" />
              <input
                type="range" min={1} max={3} step={0.02} value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 h-2 accent-green-500"
              />
              <ZoomIn className="w-4 h-4 text-white/60 flex-shrink-0" />
              <span className="text-white/40 text-xs w-8 text-right flex-shrink-0">{zoom.toFixed(1)}x</span>
            </div>

            {/* Rotation row */}
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-white/60 flex-shrink-0" />
              <input
                type="range" min={-180} max={180} step={1} value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="flex-1 h-2 accent-green-500"
              />
              <RotateCw className="w-4 h-4 text-white/60 flex-shrink-0" />
              <span className="text-white/40 text-xs w-8 text-right flex-shrink-0">{rotation}°</span>
            </div>

            {/* Icon buttons row */}
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setRotation(r => r - 90)}
                className="flex flex-col items-center gap-1 flex-1 py-3 rounded-xl bg-white/10 active:bg-white/30"
              >
                <RotateCcw className="w-5 h-5 text-white" />
                <span className="text-white/60 text-xs">Rotate L</span>
              </button>
              <button
                onClick={() => setRotation(r => r + 90)}
                className="flex flex-col items-center gap-1 flex-1 py-3 rounded-xl bg-white/10 active:bg-white/30"
              >
                <RotateCw className="w-5 h-5 text-white" />
                <span className="text-white/60 text-xs">Rotate R</span>
              </button>
              <button
                onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0); }}
                className="flex flex-col items-center gap-1 flex-1 py-3 rounded-xl bg-white/10 active:bg-white/30"
              >
                <Crop className="w-5 h-5 text-white" />
                <span className="text-white/60 text-xs">Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
            <div className="flex flex-col items-center space-y-2">
              <div className="relative w-40 h-40 rounded-full border-4 border-green-500 overflow-hidden">
                <img
                  src={profileImagePreview}
                  alt="Profile Preview"
                  className="w-full h-full object-cover"
                />
                {/* Face detection overlay badge */}
                {faceStatus === "detecting" && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>
              {/* Re-crop button */}
              <button
                onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); setShowCropper(true); }}
                disabled={isSaving}
                className="inline-flex items-center space-x-1 text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
              >
                <Crop className="w-3.5 h-3.5" />
                <span>Re-crop</span>
              </button>
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

          {/* Face Detection Status */}
          {faceStatus !== "idle" && (
            <div className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium ${
              faceStatus === "detecting"
                ? "bg-blue-50 border border-blue-200 text-blue-700"
                : faceStatus === "face_found"
                ? "bg-green-50 border border-green-200 text-green-700"
                : faceStatus === "no_face"
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-yellow-50 border border-yellow-200 text-yellow-700"
            }`}>
              {faceStatus === "detecting" && <Loader className="w-4 h-4 animate-spin flex-shrink-0" />}
              {faceStatus === "face_found" && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
              {faceStatus === "no_face" && <XCircle className="w-4 h-4 flex-shrink-0" />}
              {faceStatus === "detection_error" && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
              <span>
                {faceStatus === "detecting" && "Verifying your photo..."}
                {faceStatus === "face_found" && "Face detected — looks good!"}
                {faceStatus === "no_face" && "No face detected. Please upload a clear photo of your face."}
                {faceStatus === "detection_error" && "Could not verify photo. You may still try saving."}
              </span>
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
            disabled={!profileImage || isSaving || faceStatus === "detecting" || faceStatus === "no_face"}
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

          {/* Remind Me Later */}
          {onRemindLater && (
            canSnooze ? (
              <div className="text-center pt-1 px-4 py-3 bg-gray-300 border border-gray-200 rounded-xl">
                <button
                  onClick={() => {
                    // Increment snooze count before calling onRemindLater
                    if (userEmail) {
                      localStorage.setItem(snoozeCountKey, String(snoozeCount + 1));
                    }
                    onRemindLater();
                  }}
                  disabled={isSaving}
                  className="inline-flex items-center space-x-1.5 text-sm text-gray-700 hover:text-gray-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Remind me later ({MAX_SNOOZE_ATTEMPTS - snoozeCount} left)</span>
                </button>
                <p className="text-xs text-gray-400 mt-0.5">You will be reminded again in 24 hours</p>
              </div>
            ) : (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-center">
                <p className="text-sm font-medium text-red-700">Profile picture is now required</p>
                <p className="text-xs text-red-500 mt-0.5">You have used all {MAX_SNOOZE_ATTEMPTS} reminders. Please upload your photo to continue.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default MandatoryProfilePictureModal;
