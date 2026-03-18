// src/components/UserProfileModal.js
import React, { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";
import { getUserContext } from "../services/userContextService";
import TouchFeedbackButton from "./TouchFeedbackButton";

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

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
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
        `${apiBaseUrl}/api/get-user-profile?email=${encodeURIComponent(
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
        const profile = data.data;
        console.log("📥 [UserProfileModal] Fetched profile data:", {
          latestBmr: profile.latestBmr,
          height: profile.height,
          phoneNumber: profile.phoneNumber,
          dietType: profile.dietType
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
      fetchUserProfile();
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

  // Handle profile image selection
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

      const response = await fetch(`${apiBaseUrl}/api/update-user-profile`, {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
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
                {profileImagePreview || user?.photoURL ? (
                  <img
                    src={profileImagePreview || user.photoURL}
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
                    placeholder="1100 - 2200"
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    style={{ fontSize: "16px" }}
                    min="1100"
                    max="2200"
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
                !name || name.trim() === "" || 
                !height || height.trim() === "" || 
                !phone || phone.trim() === ""
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
