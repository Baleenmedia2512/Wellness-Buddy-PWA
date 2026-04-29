// src/components/CompleteProfilePage.js
// Full-screen blocking page shown when mandatory profile fields are missing.
// The user cannot close or bypass this page until all required fields are saved.
// Also handles profile picture upload (with Remind Me Later snooze).
import React, { useEffect, useState, useRef, useCallback } from "react";
import Cropper from "react-easy-crop";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { User, Ruler, CheckCircle2, Phone, Camera, Upload, Clock, AlertCircle, CheckCircle, XCircle, Loader, Crop, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";

const DIET_OPTIONS = [
  { value: "Vegetarian", label: "🌱 Vegetarian" },
  { value: "Non-Vegetarian", label: "🍗 Non-Vegetarian" },
  { value: "Vegan", label: "🥦 Vegan" },
  { value: "Pescatarian", label: "🐟 Pescatarian" },
];

/** Crop a canvas region supporting rotation */
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
      out.getContext("2d").drawImage(
        canvas,
        pixelCrop.x + (size / 2 - img.width / 2),
        pixelCrop.y + (size / 2 - img.height / 2),
        pixelCrop.width, pixelCrop.height,
        0, 0, outSize, outSize
      );
      resolve(out.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
};

/**
 * CompleteProfilePage
 * Full-screen blocking component that forces users to fill mandatory profile
 * fields before they can access any other part of the app.
 *
 * Required fields: Height, Phone Number, Diet Type
 * Optional (snoozable): Profile Picture
 *
 * Props:
 *   user              - authenticated user object (must have .email)
 *   apiBaseUrl        - base URL for backend API calls
 *   onComplete        - callback invoked after successful save
 *   showPictureSection - whether to also show profile picture section
 *   snoozeData        - current snooze data from DB { count, max, until }
 *   userId            - DB UserId for snooze API call
 */
const CompleteProfilePage = ({ user, apiBaseUrl, onComplete, showPictureSection = false, snoozeData = null, userId = null }) => {
  // ── Profile fields state ───────────────────────────────────────────────
  const [height, setHeight] = useState("");
  const [phone, setPhone] = useState("");
  const [dietType, setDietType] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [error, setError] = useState("");
  const [missingFields, setMissingFields] = useState({
    height: true,
    phoneNumber: true,
    dietType: true,
  });

  // ── Picture state ──────────────────────────────────────────────────────
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flip] = useState({ h: false, v: false });
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  // faceStatus: "idle" | "detecting" | "face_found" | "no_face" | "detection_error"
  const [faceStatus, setFaceStatus] = useState("idle");
  const [pictureError, setPictureError] = useState("");
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Snooze info from DB
  const snoozeCount = snoozeData?.count ?? 0;
  const snoozeMax = snoozeData?.max ?? 5;
  const canSnooze = snoozeCount < snoozeMax;

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        setIsLoadingProfile(true);
        setError("");

        const email = user?.email || user?.Email;
        if (!email) {
          throw new Error("User email is missing.");
        }

        const res = await fetch(
          `${apiBaseUrl}/api/get-user-profile?email=${encodeURIComponent(email)}&_t=${Date.now()}`,
          { cache: "no-store", headers: { "Cache-Control": "no-cache" } },
        );

        if (!res.ok) {
          throw new Error("Failed to load profile.");
        }

        const data = await res.json();
        if (!data.success || !data.data) {
          throw new Error(data.message || "Failed to load profile.");
        }

        if (!mounted) return;

        const profile = data.data;
        const hasHeight =
          typeof profile.height === "number" &&
          !Number.isNaN(profile.height) &&
          profile.height >= 50 &&
          profile.height <= 250;
        const hasPhone =
          typeof profile.phoneNumber === "string" &&
          profile.phoneNumber.trim() !== "";
        const hasDiet =
          typeof profile.dietType === "string" &&
          profile.dietType.trim() !== "";

        const nextMissing = {
          height: !hasHeight,
          phoneNumber: !hasPhone,
          dietType: !hasDiet,
        };

        setMissingFields(nextMissing);

        if (!nextMissing.height && !nextMissing.phoneNumber && !nextMissing.dietType) {
          onComplete(profile);
          return;
        }

        // Prefill current values for any field that might still be editable.
        if (nextMissing.height && hasHeight) {
          setHeight(String(profile.height));
        }
        if (nextMissing.phoneNumber && hasPhone) {
          setPhone(profile.phoneNumber);
        }
        if (nextMissing.dietType && hasDiet) {
          setDietType(profile.dietType);
        }
      } catch (err) {
        if (!mounted) return;
        console.error("❌ [CompleteProfilePage] Failed to fetch profile:", err);
        setError(err.message || "Failed to load profile. Please try again.");
      } finally {
        if (mounted) {
          setIsLoadingProfile(false);
        }
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [apiBaseUrl, onComplete, user]);

  // ── Picture helpers ────────────────────────────────────────────────────
  const detectFace = useCallback(async (base64String) => {
    setFaceStatus("detecting");
    try {
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
      if (!apiKey) { setFaceStatus("detection_error"); return; }
      const mimeMatch = base64String.match(/^data:(image\/[a-zA-Z]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const base64Data = base64String.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
      const result = await model.generateContent([
        { inlineData: { mimeType, data: base64Data } },
        "Look at this image carefully. Is it a real photograph of an actual human being taken with a camera or phone? Answer 'no' if the image is: a cartoon, an illustrated avatar, a drawing, a vector/clip art icon, anime, 3D CGI, AI-generated art, a painting, a sketch, or has any glowing/robotic/cybernetic elements. Answer 'no' if the face looks drawn or stylized rather than photographed. Only answer 'yes' if it is clearly a real photo of a real person. Answer with only 'yes' or 'no'.",
      ]);
      const text = result.response.text().trim().toLowerCase();
      setFaceStatus(text.startsWith("yes") ? "face_found" : "no_face");
    } catch (err) {
      setFaceStatus("detection_error");
    }
  }, []);

  const handleImageSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setPictureError("Please select a valid image file"); return; }
    if (file.size > 5 * 1024 * 1024) { setPictureError("Image size must be less than 5MB"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      setRawImageSrc(e.target.result);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setShowCropper(true);
      setPictureError("");
    };
    reader.onerror = () => setPictureError("Failed to read image file");
    reader.readAsDataURL(file);
  };

  const handleCropComplete = useCallback((_, pixels) => { setCroppedAreaPixels(pixels); }, []);

  const handleCropApply = useCallback(async () => {
    if (!rawImageSrc || !croppedAreaPixels) return;
    try {
      const cropped = await getCroppedImg(rawImageSrc, croppedAreaPixels, rotation, flip);
      setProfileImage(cropped);
      setProfileImagePreview(cropped);
      setShowCropper(false);
      setFaceStatus("idle");
      detectFace(cropped);
    } catch { setPictureError("Failed to crop image. Please try again."); }
  }, [rawImageSrc, croppedAreaPixels, rotation, flip, detectFace]);

  const handleRemindLater = async () => {
    // Must fill mandatory profile fields before snoozing picture
    setError("");
    if (!formValid) {
      if (!heightValid) setError("Please enter a valid height (50 - 250 cm) before continuing.");
      else if (!phoneValid) setError("Please enter a valid phone number before continuing.");
      else if (!dietValid) setError("Please select a diet preference before continuing.");
      return;
    }

    setIsSaving(true);
    try {
      // Save profile fields first
      const payload = { email: user.email || user.Email };
      if (missingFields.height) payload.height = parseFloat(height);
      if (missingFields.phoneNumber) payload.phoneNumber = phone.trim();
      if (missingFields.dietType) payload.dietType = dietType;

      const res = await fetch(`${apiBaseUrl}/api/update-user-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to save profile.");

      // Then snooze the picture
      if (userId) {
        try {
          const snoozeRes = await fetch(`${apiBaseUrl}/api/snooze-profile-pic`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });
          const snoozeData = await snoozeRes.json();
          if (snoozeData.success) console.log("⏰ [CompleteProfile] Picture snoozed:", snoozeData.snooze);
        } catch (err) {
          console.error("❌ [CompleteProfile] Snooze failed:", err);
        }
      }

      onComplete({});
    } catch (err) {
      setError(err.message || "Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Validation
  const heightValid =
    !missingFields.height ||
    (height !== "" &&
      !isNaN(parseFloat(height)) &&
      parseFloat(height) >= 50 &&
      parseFloat(height) <= 250);

  const phoneValid =
    !missingFields.phoneNumber ||
    (phone.trim() !== "" &&
      /^\+?[0-9]{10,15}$/.test(phone.trim().replace(/[\s\-()]/g, "")));

  const dietValid = !missingFields.dietType || !!dietType;
  const pictureHandled = !showPictureSection || (profileImage && faceStatus === "face_found");
  const formValid = heightValid && phoneValid && dietValid;

  const requiredChecks = [];
  if (missingFields.height) requiredChecks.push({ label: "Height", done: heightValid });
  if (missingFields.phoneNumber) requiredChecks.push({ label: "Phone Number", done: phoneValid });
  if (missingFields.dietType) requiredChecks.push({ label: "Diet Preference", done: dietValid });

  // Save handler
  const handleSave = async () => {
    setError("");
    if (!formValid) {
      if (!heightValid) setError("Please enter a valid height (50 - 250 cm).");
      else if (!phoneValid) setError("Please enter a valid phone number (10-15 digits).");
      else if (!dietValid) setError("Please select a diet preference.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        email: user.email || user.Email,
      };

      if (missingFields.height) {
        payload.height = parseFloat(height);
      }
      if (missingFields.phoneNumber) {
        payload.phoneNumber = phone.trim();
      }
      if (missingFields.dietType) {
        payload.dietType = dietType;
      }

      const res = await fetch(`${apiBaseUrl}/api/update-user-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Unexpected server response. Please try again.");
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to save profile.");
      }

      // If picture was provided, save it too
      if (showPictureSection && profileImage) {
        const picRes = await fetch(`${apiBaseUrl}/api/update-user-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email || user.Email, profileImage }),
        });
        const picData = await picRes.json();
        if (!picRes.ok || !picData.success) {
          throw new Error(picData.message || "Failed to save profile picture.");
        }
      }

      console.log("✅ [CompleteProfilePage] Profile saved — unlocking app.");
      onComplete({
        height: missingFields.height ? parseFloat(height) : undefined,
        phoneNumber: missingFields.phoneNumber ? phone.trim() : undefined,
        dietType: missingFields.dietType ? dietType : undefined,
        profileImage: profileImage || undefined,
      });
    } catch (err) {
      console.error("❌ [CompleteProfilePage] Save error:", err);
      setError(err.message || "Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Render
  return (
    // z-[300] ensures this overlay sits above ALL other modals/pages
    <div
      className="fixed inset-0 bg-gray-50 overflow-y-auto"
      style={{ zIndex: 300 }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 pt-14 pb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-white/20 rounded-full p-2 flex-shrink-0">
            <User className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            Complete Your Profile
          </h1>
        </div>
        <p className="text-green-100 text-sm leading-relaxed">
          A few details are needed to personalise your wellness journey and
          enable accurate nutrition tracking.
        </p>
      </div>

      {/* Progress checklist */}
      <div className="max-w-md mx-auto px-6 mt-5">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex gap-4 shadow-sm flex-wrap">
          {isLoadingProfile ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-transparent" />
              Checking required profile fields...
            </div>
          ) : requiredChecks.length === 0 ? (
            <div className="text-sm text-green-700 font-medium">All required fields are already complete.</div>
          ) : (
            requiredChecks.map((f) => (
              <div key={f.label} className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-4 h-4 flex-shrink-0 ${
                    f.done ? "text-green-500" : "text-gray-300"
                  }`}
                />
                <span
                  className={`text-xs font-medium ${
                    f.done ? "text-green-700 line-through" : "text-gray-500"
                  }`}
                >
                  {f.label}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Form */}
      <div className="max-w-md mx-auto px-6 py-6 space-y-5 pb-16">

        {/* Height (required) */}
        {missingFields.height && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Height (cm) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="number"
              inputMode="decimal"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="e.g. 170"
              className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none text-base bg-white ${
                height && !heightValid
                  ? "border-red-300 focus:border-red-400"
                  : "border-gray-200 focus:border-green-400"
              }`}
              style={{ fontSize: "16px" }}
              min="50"
              max="250"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Range: 50 - 250 cm</p>
        </div>
        )}

        {/* Phone Number (required) */}
        {missingFields.phoneNumber && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 9876543210"
              className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none text-base bg-white ${
                phone && !phoneValid
                  ? "border-red-300 focus:border-red-400"
                  : "border-gray-200 focus:border-green-400"
              }`}
              style={{ fontSize: "16px" }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">10-15 digits, with optional country code</p>
        </div>
        )}

        {/* Diet Preference (required) */}
        {missingFields.dietType && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Diet Preference <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {DIET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDietType(opt.value)}
                className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                  dietType === opt.value
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        )}

        {/* Profile Picture Section */}
        {showPictureSection && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Camera className="w-5 h-5 text-green-600" />
              <span className="text-sm font-semibold text-gray-700">Profile Picture</span>
              <span className="text-xs text-gray-400 ml-1">(optional — can remind later)</span>
            </div>

            {/* Cropper */}
            {showCropper && rawImageSrc && (
              <div className="rounded-2xl overflow-hidden border border-gray-200 bg-black" style={{ height: 260 }}>
                <div className="relative w-full h-full">
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
                    onCropComplete={handleCropComplete}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 p-2 bg-gray-900">
                  <div className="flex gap-2">
                    <button onClick={() => setRotation(r => r - 90)} className="p-1.5 text-white hover:bg-gray-700 rounded-lg"><RotateCcw className="w-4 h-4" /></button>
                    <button onClick={() => setRotation(r => r + 90)} className="p-1.5 text-white hover:bg-gray-700 rounded-lg"><RotateCw className="w-4 h-4" /></button>
                    <button onClick={() => setZoom(z => Math.max(1, z - 0.2))} className="p-1.5 text-white hover:bg-gray-700 rounded-lg"><ZoomOut className="w-4 h-4" /></button>
                    <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="p-1.5 text-white hover:bg-gray-700 rounded-lg"><ZoomIn className="w-4 h-4" /></button>
                  </div>
                  <button onClick={handleCropApply} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600">
                    <Crop className="w-4 h-4" /> Apply
                  </button>
                </div>
              </div>
            )}

            {/* Preview */}
            {!showCropper && profileImagePreview && (
              <div className="flex items-center gap-4">
                <img src={profileImagePreview} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-green-400 shadow" />
                <div className="flex-1">
                  {faceStatus === "detecting" && (
                    <div className="flex items-center gap-2 text-sm text-blue-600"><Loader className="w-4 h-4 animate-spin" /> Verifying face...</div>
                  )}
                  {faceStatus === "face_found" && (
                    <div className="flex items-center gap-2 text-sm text-green-600"><CheckCircle className="w-4 h-4" /> Real face detected ✓</div>
                  )}
                  {faceStatus === "no_face" && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-red-600"><XCircle className="w-4 h-4" /> No real face detected</div>
                      <p className="text-xs text-gray-500">Please use a real photo (not cartoon/avatar)</p>
                    </div>
                  )}
                  {faceStatus === "detection_error" && (
                    <div className="flex items-center gap-2 text-sm text-amber-600"><AlertCircle className="w-4 h-4" /> Could not verify — please retake</div>
                  )}
                  <button onClick={() => { setProfileImage(null); setProfileImagePreview(null); setFaceStatus("idle"); }} className="text-xs text-gray-400 underline mt-1">Remove</button>
                </div>
              </div>
            )}

            {/* Upload buttons */}
            {!showCropper && !profileImagePreview && (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center gap-2 py-4 border-2 border-blue-200 rounded-xl text-blue-600 hover:bg-blue-50 font-semibold text-sm transition-all">
                  <Camera className="w-6 h-6" /> Take Photo
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 py-4 border-2 border-green-200 rounded-xl text-green-600 hover:bg-green-50 font-semibold text-sm transition-all">
                  <Upload className="w-6 h-6" /> From Gallery
                </button>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={e => handleImageSelect(e.target.files?.[0])} />
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageSelect(e.target.files?.[0])} />
              </div>
            )}

            {/* Picture error */}
            {pictureError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm">{pictureError}</div>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={isLoadingProfile || !formValid || isSaving || (showPictureSection && profileImage && faceStatus !== "face_found" && faceStatus !== "detection_error")}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-all shadow-sm ${
            !isLoadingProfile && formValid && !isSaving && !(showPictureSection && profileImage && faceStatus !== "face_found" && faceStatus !== "detection_error")
              ? "bg-green-500 hover:bg-green-600 active:bg-green-700 text-white shadow-green-200 shadow-lg"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              Saving...
            </span>
          ) : (
            "Save & Continue →"
          )}
        </button>

        {/* Remind Me Later for picture */}
        {showPictureSection && !profileImage && (
          canSnooze ? (
            <div className="text-center pt-1 px-3 py-3 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-2xl shadow-sm">
              <button
                onClick={handleRemindLater}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-xl shadow-sm hover:bg-gray-50 hover:text-gray-800 hover:border-gray-400 hover:shadow-md active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Clock className="w-4 h-4 flex-shrink-0 text-amber-500" />
                <span>Remind me later</span>
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-bold text-white bg-amber-400 rounded-full leading-none">
                  {snoozeMax - snoozeCount}
                </span>
              </button>
              <p className="text-xs text-gray-400 mt-2">Reminder in 24 hours &bull; {snoozeMax - snoozeCount} of {snoozeMax} left</p>
            </div>
          ) : (
            <div className="px-3 py-3 bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-2xl shadow-sm text-center">
              <p className="text-sm font-semibold text-red-700">Profile picture is now required</p>
              <p className="text-xs text-red-400 mt-0.5">All {snoozeMax} reminders used. Please upload your photo to continue.</p>
            </div>
          )
        )}

        <p className="text-xs text-gray-400 text-center">
          You can update these details anytime from your profile settings.
        </p>
      </div>
    </div>
  );
};

export default CompleteProfilePage;
