// src/components/UserProfileModal.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import Cropper from "react-easy-crop";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  X,
  Save,
  CheckCircle,
  Flame,
  ChevronDown,
  Camera,
  Phone,
  User,
  Ruler,
  Crop,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  XCircle,
  Loader,
} from "lucide-react";
import { getUserContext } from "../services/userContextService";
import TouchFeedbackButton from "./TouchFeedbackButton";

/** Crop a canvas region supporting rotation */
const getCroppedImg = (imageSrc, pixelCrop, rotation = 0) => {
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
 * User Profile Modal
 * Displays user information and allows editing profile fields
 */
const UserProfileModal = ({
  isOpen,
  onClose,
  user,
  userRole = "user",
  onProfileUpdate,
}) => {
  const [name, setName] = useState("");
  const [height, setHeight] = useState("");
  const [bmr, setBmr] = useState("");
  const [phone, setPhone] = useState("");
  const [dietType, setDietType] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [isDietDropdownOpen, setIsDietDropdownOpen] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState("");
  const [hasSaved, setHasSaved] = useState(false);

  // faceStatus: "idle" | "detecting" | "face_found" | "no_face" | "detection_error"
  const [faceStatus, setFaceStatus] = useState("idle");
  // showFaceToast: controls toast visibility only — dismissing hides toast but keeps faceStatus
  const [showFaceToast, setShowFaceToast] = useState(false);

  // Crop state
  const [rawImageSrc, setRawImageSrc] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

  // Holds a Promise that resolves with the face status once detection completes
  const faceDetectionPromiseRef = useRef(null);
  const faceDetectionResolveRef = useRef(null);
  // Always points to the latest handleSave so useEffect can call it without stale closure
  const handleSaveRef = useRef(null);

  // Call Gemini directly (client-side) for face detection
  const detectFace = useCallback(async (base64String) => {
    // Create a promise so handleSave can await the result
    faceDetectionPromiseRef.current = new Promise((resolve) => {
      faceDetectionResolveRef.current = resolve;
    });
    setFaceStatus("detecting");
    setShowFaceToast(true);
    try {
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("⚠️ [Face Detection] REACT_APP_GEMINI_API_KEY not set, skipping");
        setFaceStatus("detection_error");
        faceDetectionResolveRef.current?.("detection_error");
        return;
      }

      const mimeMatch = base64String.match(/^data:(image\/[a-zA-Z]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const base64Data = base64String.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

      const result = await model.generateContent([
        { inlineData: { mimeType, data: base64Data } },
        "Look at this image carefully. Is it a real photograph of an actual human being taken with a camera or phone? Answer 'no' if the image is: a cartoon, an illustrated avatar, a drawing, a vector/clip art icon, anime, 3D CGI, AI-generated art, a painting, a sketch, or if the face has cybernetic parts, glowing eyes, or unrealistic skin textures. Answer 'no' if the face looks drawn or stylized rather than photographed. Only answer 'yes' if it is clearly a real photo of a real person. Answer with only 'yes' or 'no'.",
      ]);

      const text = result.response.text().trim().toLowerCase();
      const hasFace = text.startsWith("yes");
      const status = hasFace ? "face_found" : "no_face";
      console.log(`✅ [Face Detection] Result: ${hasFace ? "face found" : "no face"} (raw: "${text}")`);
      setFaceStatus(status);
      setShowFaceToast(true);
      faceDetectionResolveRef.current?.(status);
    } catch (err) {
      console.error("❌ [Face Detection] Failed:", err.message);
      setFaceStatus("detection_error");
      setShowFaceToast(true);
      faceDetectionResolveRef.current?.("detection_error");
    }
  }, []);

  const dropdownOptionsRef = useRef(null);
  const modalContentRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch user profile data
  const fetchUserProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const cacheBuster = Date.now();
      const response = await fetch(
        `${apiBaseUrl}/api/user/profile?email=${encodeURIComponent(
          user.email,
        )}&_t=${cacheBuster}`,
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }

      const data = await response.json();

      if (data.success && data.data) {
        let profile = data.data;

        // 🔒 Demo account: load locally-saved profile if API returned empty fields
        const DEMO_ACCOUNTS = ['testereasywork@gmail.com'];
        if (DEMO_ACCOUNTS.includes((user.email || '').toLowerCase().trim())) {
          const stored = localStorage.getItem(`demo_profile_${user.email}`);
          if (stored) {
            try {
              const local = JSON.parse(stored);
              console.log('💾 [Demo] Loading profile from localStorage:', local);
              profile = { ...profile, ...local };
            } catch (e) { /* ignore */ }
          }
        }

        console.log("📥 [UserProfileModal] Fetched profile data:", {
          latestBmr: profile.latestBmr,
          latestWeight: profile.latestWeight,
          weightRecordDate: profile.weightRecordDate,
          height: profile.height,
          phoneNumber: profile.phoneNumber,
          dietType: profile.dietType,
        });
        setName(profile.userName || user.name || "");
        setHeight(profile.height ? String(profile.height) : "");
        setBmr(profile.latestBmr ? String(Math.round(profile.latestBmr)) : "");
        setPhone(profile.phoneNumber || "");
        setDietType(profile.dietType || "");
        // Set existing profile image if available
        if (profile.profileImage) {
          setProfileImagePreview(profile.profileImage);
        }
        console.log("✅ [UserProfileModal] BMR set to state:", profile.latestBmr ? String(Math.round(profile.latestBmr)) : "(empty)");
      } else if (data.success && !data.data) {
        // 🔒 Demo account bypass: API returns top-level fields (no data wrapper)
        // Load from localStorage instead
        const stored = localStorage.getItem(`demo_profile_${user.email}`);
        if (stored) {
          try {
            const local = JSON.parse(stored);
            console.log('💾 [Demo] Loading profile from localStorage (no data wrapper):', local);
            setName(local.userName || user?.name || "");
            setHeight(local.height ? String(local.height) : "");
            setBmr(local.latestBmr ? String(Math.round(local.latestBmr)) : "");
            setPhone(local.phoneNumber || "");
            setDietType(local.dietType || "");
            if (local.profileImage) setProfileImagePreview(local.profileImage);
          } catch (e) { /* ignore */ }
        } else {
          // No stored data — use API top-level fields as fallback
          setName(data.userName || user?.name || "");
        }
      }
    } catch (err) {
      console.error("❌ Error fetching user profile:", err);
      // Fall back to user object data
      setName(user?.name || "");
      setHeight("");
      setBmr("");
      setDietType("");
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, user]);

  // Auto-scroll to show all dropdown options when dropdown opens
  useEffect(() => {
    if (
      isDietDropdownOpen &&
      dropdownOptionsRef.current &&
      modalContentRef.current
    ) {
      setTimeout(() => {
        // Scroll to the dropdown options to ensure they're fully visible
        dropdownOptionsRef.current.scrollIntoView({
          behavior: "smooth",
          block: "end", // Align to bottom to show all options
          inline: "nearest",
        });
      }, 100);
    }
  }, [isDietDropdownOpen]);

  // Fetch user profile when modal opens
  useEffect(() => {
    if (isOpen && user?.email) {
      // Reset states when modal opens
      setSuccessMessage("");
      setHasSaved(false);
      setError("");
      setProfileImage(null);
      setFaceStatus("idle");
      setRawImageSrc(null);
      setShowFaceToast(false);
      fetchUserProfile();
    }
    if (!isOpen) {
      setFaceStatus("idle");
      setShowFaceToast(false);
    }
  }, [isOpen, user?.email, fetchUserProfile]);

  // Auto-dismiss success message and close modal after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage("");
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, onClose]);

  // Handle profile image selection — opens cropper
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
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
      const cropped = await getCroppedImg(rawImageSrc, croppedAreaPixels, rotation);
      setProfileImage(cropped);
      setProfileImagePreview(cropped);
      setShowCropper(false);
      setFaceStatus("idle");
      setShowFaceToast(false);
      setError("");
      detectFace(cropped);
    } catch (err) {
      setError("Failed to crop image. Please try again.");
    }
  }, [rawImageSrc, croppedAreaPixels, rotation, detectFace]);

  // Trigger file input click
  const handleProfileImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleSave = async () => {
    try {
      setError("");
      setSuccessMessage("");
      setIsSaving(true);

      // Validate name (mandatory field)
      if (!name || name.trim() === "") {
        setError("Name is required");
        setIsSaving(false);
        return;
      }

      // Validate height (mandatory field)
      if (!height || height.trim() === "") {
        setError("Height is required");
        setIsSaving(false);
        return;
      }

      // Validate height range
      const heightValue = parseFloat(height);
      if (isNaN(heightValue) || heightValue < 50 || heightValue > 198) {
        setError("Height must be between 50 and 198 cm (max 6.5 feet)");
        setIsSaving(false);
        return;
      }

      // Validate phone number (mandatory field)
      if (!phone || phone.trim() === "") {
        setError("Phone number is required");
        setIsSaving(false);
        return;
      }

      // Validate phone number format
      const cleanedPhone = phone.trim().replace(/[\s\-()]/g, "");
      if (!/^\+?[0-9]{10,15}$/.test(cleanedPhone)) {
        setError("Please enter a valid phone number (10-15 digits)");
        setIsSaving(false);
        return;
      }

      // Face detection check — only when a new profile photo is being saved
      if (profileImage) {
        let resolvedStatus = faceStatus;
        // If still detecting, wait for it to finish
        if (resolvedStatus === "detecting" && faceDetectionPromiseRef.current) {
          resolvedStatus = await faceDetectionPromiseRef.current;
        }
        if (resolvedStatus === "no_face") {
          setError("No face detected. Please upload a clear photo of your face.");
          setIsSaving(false);
          return;
        }
        if (resolvedStatus === "detection_error") {
          setError("Photo verification failed. Please try again with a different photo.");
          setIsSaving(false);
          return;
        }
      }

      const response = await fetch(`${apiBaseUrl}/api/user/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          name: name || undefined,
          height: height ? parseFloat(height) : undefined,
          bmr: bmr && bmr.trim() !== "" ? parseFloat(bmr) : undefined,
          dietType: dietType || undefined,
          phoneNumber: phone.trim() || undefined,
          profileImage: profileImage || undefined,
        }),
      });

      console.log("📤 [UserProfileModal] Sent BMR to backend:", bmr && bmr.trim() !== "" ? parseFloat(bmr) : undefined);

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
          data.message || data.error || "Failed to update profile",
        );
      }

      if (data.success) {
        // 🔒 Demo account: persist profile locally since no DB write happens
        const DEMO_ACCOUNTS = ['testereasywork@gmail.com'];
        if (DEMO_ACCOUNTS.includes((user.email || '').toLowerCase().trim())) {
          const demoProfile = {
            userName: name || '',
            height: height ? parseFloat(height) : null,
            latestBmr: bmr ? parseFloat(bmr) : null,
            dietType: dietType || '',
            phoneNumber: phone ? phone.trim() : '',
            profileImage: profileImagePreview || null,
          };
          localStorage.setItem(`demo_profile_${user.email}`, JSON.stringify(demoProfile));
          console.log('💾 [Demo] Profile saved to localStorage');
        }

        // Notify parent component of the update
        if (onProfileUpdate) {
          onProfileUpdate({
            name,
            height: height ? parseFloat(height) : null,
            bmr: bmr ? parseFloat(bmr) : null,
            dietType: dietType || null,
            profileImage: profileImagePreview || null,
          });
        }

        // Refresh user context to update AI personalization (especially diet preference)
        if (user?.id) {
          console.log("🔄 [Profile Update] Refreshing user context...");
          getUserContext(user.id)
            .then(() =>
              console.log("✅ [Profile Update] User context refreshed"),
            )
            .catch((error) =>
              console.error(
                "❌ [Profile Update] Failed to refresh context:",
                error,
              ),
            );
        }

        // Refetch profile data to show updated values immediately
        await fetchUserProfile();
        console.log("✅ [Profile Update] Profile data refresched after save");

        // Show success message and keep modal open
        setSuccessMessage("Profile saved successfully!");
        setHasSaved(true);
        setProfileImage(null); // Clear temp image data after save
      } else {
        throw new Error(data.message || "Failed to update profile");
      }
    } catch (err) {
      console.error("❌ Error updating profile:", err);
      setError(err.message || "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  // Keep ref in sync with latest handleSave (must be after handleSave definition)
  handleSaveRef.current = handleSave;

  // Auto-save when face detection succeeds; show error when it fails
  useEffect(() => {
    if (faceStatus === "face_found" && profileImage) {
      handleSaveRef.current?.();
    } else if (faceStatus === "no_face") {
      setError("No face detected. Please upload a clear real photo of your face.");
    } else if (faceStatus === "detection_error") {
      setError("Photo verification failed. Please try again with a different photo.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceStatus]);

  const handleCancel = () => {
    // Prevent closing modal while saving is in progress
    if (isSaving) return;
    setError("");
    onClose();
  };

  // Generate initial for avatar fallback
  const getInitialAvatar = () => {
    const userName = name || user?.displayName || user?.name || "";
    const userEmail = user?.email || "";
    if (userName) return userName.charAt(0).toUpperCase();
    if (userEmail) return userEmail.charAt(0).toUpperCase();
    return "U";
  };

  // Generate color based on name/email
  const getInitialAvatarColor = () => {
    const userName = name || user?.displayName || user?.name || "";
    const userEmail = user?.email || "";
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-yellow-500",
      "bg-red-500",
      "bg-teal-500",
    ];
    const colorIndex = (userName || userEmail || "").length % colors.length;
    return colors[colorIndex];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">

      {/* ── Face Detection Toast Popup ─────────────────────── */}
      {showFaceToast && faceStatus !== "idle" && (
        <div
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 bg-white rounded-2xl w-[92%] max-w-xs animate-[fadeSlideDown_0.25s_ease-out] overflow-hidden"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
        >
          {/* Colored left accent bar */}
          <div className={`self-stretch w-1 flex-shrink-0 rounded-l-2xl ${
            faceStatus === "detecting" ? "bg-blue-400"
            : faceStatus === "face_found" ? "bg-green-500"
            : faceStatus === "no_face" ? "bg-red-500"
            : "bg-amber-400"
          }`} />
          {/* Icon */}
          <div className={`flex-shrink-0 ${
            faceStatus === "detecting" ? "text-blue-500"
            : faceStatus === "face_found" ? "text-green-500"
            : faceStatus === "no_face" ? "text-red-500"
            : "text-amber-500"
          }`}>
            {faceStatus === "detecting" && <Loader className="w-5 h-5 animate-spin" />}
            {faceStatus === "face_found" && <CheckCircle className="w-5 h-5" />}
            {faceStatus === "no_face" && <XCircle className="w-5 h-5" />}
            {faceStatus === "detection_error" && <AlertCircle className="w-5 h-5" />}
          </div>
          {/* Text */}
          <div className="flex-1 min-w-0 py-3 pr-1">
            <p className="text-sm font-semibold text-gray-800 leading-tight">
              {faceStatus === "detecting" && "Verifying photo..."}
              {faceStatus === "face_found" && "Face verified!"}
              {faceStatus === "no_face" && "No face detected"}
              {faceStatus === "detection_error" && "Verification failed"}
            </p>
            <p className="text-[11px] mt-0.5 text-gray-500 leading-snug">
              {faceStatus === "detecting" && "AI is checking your profile photo."}
              {faceStatus === "face_found" && "Your photo is ready to save."}
              {faceStatus === "no_face" && "Upload a clear photo of your face."}
              {faceStatus === "detection_error" && "Please try a different photo."}
            </p>
          </div>
          {/* Dismiss */}
          {faceStatus !== "detecting" && (
            <button
              onClick={() => setShowFaceToast(false)}
              className="flex-shrink-0 w-8 h-8 mr-2 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          )}
        </div>
      )}

      {/* ── Crop Overlay ─────────────────────────────────────────── */}
      {showCropper && rawImageSrc && (
        <div className="absolute inset-0 flex flex-col bg-black" style={{ zIndex: 60 }}>
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
          <div className="bg-black/90 px-4 pt-3 pb-6 space-y-3" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
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

            {/* Icon buttons row — Rotate L / Reset / Rotate R */}
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setRotation(r => r - 90)}
                className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl bg-white/10 active:bg-white/25 border border-white/10"
              >
                <RotateCcw className="w-4 h-4 text-white" />
                <span className="text-white/80 text-xs font-medium">-90°</span>
              </button>
              <button
                onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0); }}
                className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl bg-green-500/20 active:bg-green-500/40 border border-green-500/30"
              >
                <Crop className="w-4 h-4 text-green-400" />
                <span className="text-green-300 text-xs font-medium">Reset</span>
              </button>
              <button
                onClick={() => setRotation(r => r + 90)}
                className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl bg-white/10 active:bg-white/25 border border-white/10"
              >
                <RotateCw className="w-4 h-4 text-white" />
                <span className="text-white/80 text-xs font-medium">+90°</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={modalContentRef}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header with User Photo and Name */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-green-500 to-green-600 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            {/* Profile Image with Upload */}
            <div className="relative">
              <div
                onClick={handleProfileImageClick}
                className="w-16 h-16 rounded-full border-2 border-white overflow-hidden cursor-pointer hover:border-green-100 transition-all group relative"
              >
                {profileImagePreview ? (
                  <img
                    src={profileImagePreview}
                    alt={user.displayName || user.name || "User"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className={`w-full h-full flex items-center justify-center text-white font-bold text-2xl ${getInitialAvatarColor()}`}
                  >
                    {getInitialAvatar()}
                  </div>
                )}
                {/* Camera overlay on hover */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                {/* Face detection spinner overlay */}
                {faceStatus === "detecting" && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white">
                  {name || user?.displayName || user?.name || "User"}
                </h2>
                {userRole === "admin" && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-900 flex-shrink-0">
                    Admin
                  </span>
                )}
                {userRole === "developer" && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-900 flex-shrink-0">
                    Developer
                  </span>
                )}
                {userRole === "coach" && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-900 flex-shrink-0">
                    Coach
                  </span>
                )}
                {(!userRole || userRole === "user") && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-900 flex-shrink-0">
                    User
                  </span>
                )}
              </div>
              <p className="text-sm text-green-50">{user?.email}</p>
              <p className="text-xs text-green-100 mt-1">
                Click photo to change
              </p>
              {/* Re-crop button: only when a cropped image is active */}
              {profileImagePreview && rawImageSrc && (
                <button
                  onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); setShowCropper(true); }}
                  className="inline-flex items-center gap-1 text-xs text-green-100 hover:text-white font-medium mt-0.5"
                >
                  <Crop className="w-3 h-3" />
                  Re-crop
                </button>
              )}
            </div>
          </div>
          <TouchFeedbackButton
            onClick={handleCancel}
            disabled={isSaving}
            className="p-2 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
            ariaLabel="Close"
          >
            <X className="w-5 h-5 text-white" />
          </TouchFeedbackButton>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-transparent"></div>
            </div>
          ) : (
            <>
              {/* Editable Fields */}
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    style={{ fontSize: "16px" }}
                  />
                </div>

                {/* Height */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Height (cm) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="e.g. 170"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    style={{ fontSize: "16px" }}
                    min="50"
                    max="198"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 9876543210"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    style={{ fontSize: "16px" }}
                  />
                </div>

                {/* BMR */}
                <div>
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                    <Flame className="w-4 h-4 text-orange-500" />
                    BMR (kcal)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={bmr}
                    onChange={(e) => setBmr(e.target.value)}
                    placeholder="e.g. 2200"
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    style={{ fontSize: "16px" }}
                  />
                </div>

                {/* Diet Preference - Dropdown */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Diet Preference
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsDietDropdownOpen(!isDietDropdownOpen)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-left flex items-center justify-between"
                  >
                    <span
                      className={`flex items-center gap-2 ${
                        dietType ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {dietType === "Vegetarian" && "🌱"}
                      {dietType === "Non-Vegetarian" && "🍗"}
                      {dietType === "Vegan" && "🥦"}
                      {dietType === "Pescatarian" && "🐟"}
                      {dietType || "Select diet preference"}
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        isDietDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Dropdown Options */}
                  {isDietDropdownOpen && (
                    <div
                      ref={dropdownOptionsRef}
                      className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-gray-300 shadow-lg overflow-hidden"
                    >
                      {[
                        {
                          value: "Vegetarian",
                          label: "Vegetarian",
                          icon: "🌱",
                        },
                        {
                          value: "Non-Vegetarian",
                          label: "Non-Vegetarian",
                          icon: "🍗",
                        },
                        { value: "Vegan", label: "Vegan", icon: "🥦" },
                        {
                          value: "Pescatarian",
                          label: "Pescatarian",
                          icon: "🐟",
                        },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setDietType(option.value);
                            setIsDietDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center gap-2 ${
                            dietType === option.value
                              ? "bg-green-50 text-green-900"
                              : "text-gray-700"
                          }`}
                        >
                          <span className="text-lg">{option.icon}</span>
                          <span>{option.label}</span>
                          {dietType === option.value && (
                            <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    AI will prioritize foods matching your diet preference
                  </p>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
                  {error}
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  {successMessage}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!isLoading && (
          <div className="flex items-center gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <TouchFeedbackButton
              onClick={handleCancel}
              disabled={isSaving}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              ariaLabel="Cancel"
            >
              <X className="w-5 h-5" />
              {hasSaved ? "Close" : "Cancel"}
            </TouchFeedbackButton>
            <TouchFeedbackButton
              onClick={handleSave}
              disabled={
                isSaving ||
                !name ||
                name.trim() === "" ||
                !height ||
                height.trim() === "" ||
                !phone ||
                phone.trim() === ""
              }
              className="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
              ariaLabel="Save profile"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save
                </>
              )}
            </TouchFeedbackButton>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfileModal;
