// src/components/UserProfileModal.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Save, CheckCircle, Flame, ChevronDown, Camera } from "lucide-react";
import { getUserContext } from "../services/userContextService";
import TouchFeedbackButton from "./TouchFeedbackButton";

/**
 * User Profile Modal
 * Displays user information and allows editing profile fields
 */
const UserProfileModal = ({ isOpen, onClose, user, onProfileUpdate }) => {
  const [name, setName] = useState("");
  const [height, setHeight] = useState("");
  const [bmr, setBmr] = useState("");
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
        setName(profile.userName || user.name || "");
        setHeight(profile.height ? String(profile.height) : "");
        setBmr(profile.latestBmr ? String(Math.round(profile.latestBmr)) : "");
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
      setProfileImagePreview(null);
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

      // Validate inputs
      if (height && (parseFloat(height) < 50 || parseFloat(height) > 198)) {
        setError("Height must be between 50 and 198 cm (max 6.5 feet)");
        setIsSaving(false);
        return;
      }

      // Validate BMR if provided
      if (bmr && bmr.trim() !== "") {
        const bmrValue = parseFloat(bmr);
        if (isNaN(bmrValue) || bmrValue < 1100 || bmrValue > 2200) {
          setError("BMR must be between 1100 and 2200 kcal/day");
          setIsSaving(false);
          return;
        }
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
        // Update BMR if it was recalculated
        if (data.data?.bmr) {
          setBmr(String(Math.round(data.data.bmr)));
        }

        // Notify parent component of the update
        if (onProfileUpdate) {
          onProfileUpdate({
            name,
            height: height ? parseFloat(height) : null,
            bmr: data.data?.bmr || (bmr ? parseFloat(bmr) : null),
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
              <h2 className="text-xl font-bold text-white">
                {name || user?.displayName || user?.name || "User"}
              </h2>
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-400 focus:outline-none text-base bg-white"
                    style={{ fontSize: "16px" }}
                  />
                </div>

                {/* Height */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="e.g., 183 (6 feet)"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-400 focus:outline-none text-base bg-white"
                    style={{ fontSize: "16px" }}
                    min="50"
                    max="198"
                  />
                </div>

                {/* BMR */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-500" />
                      BMR (kcal)
                    </span>
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={bmr}
                    onChange={(e) => setBmr(e.target.value)}
                    placeholder="e.g., 1650"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-orange-400 focus:outline-none text-base bg-white"
                    style={{ fontSize: "16px" }}
                    min="1100"
                    max="2200"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Basal Metabolic Rate (1100 - 2200 kcal/day)
                  </p>
                </div>

                {/* Diet Preference - Custom Dropdown */}
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Diet Preference
                  </label>

                  {/* Dropdown Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setIsDietDropdownOpen(!isDietDropdownOpen)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 bg-white text-left transition-all hover:border-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-base truncate">
                        {dietType ? (
                          <>
                            {dietType === "Vegetarian" && "🌱 Vegetarian"}
                            {dietType === "Non-Vegetarian" &&
                              "🍗 Non-Vegetarian"}
                            {dietType === "Vegan" && "🥦 Vegan"}
                            {dietType === "Pescatarian" && "🐟 Pescatarian"}
                          </>
                        ) : (
                          <span className="text-gray-400">
                            Select diet type
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ml-2 ${
                        isDietDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Dropdown Options */}
                  {isDietDropdownOpen && (
                    <div
                      ref={dropdownOptionsRef}
                      className="absolute z-50 w-full mt-2 bg-white rounded-xl border-2 border-gray-300 shadow-lg overflow-hidden"
                    >
                      {[
                        {
                          value: "Vegetarian",
                          label: "🌱 Vegetarian",
                          desc: "No meat or fish",
                        },
                        {
                          value: "Non-Vegetarian",
                          label: "🍗 Non-Vegetarian",
                          desc: "Includes all foods",
                        },
                        {
                          value: "Vegan",
                          label: "🥦 Vegan",
                          desc: "No animal products",
                        },
                        {
                          value: "Pescatarian",
                          label: "🐟 Pescatarian",
                          desc: "Fish but no meat",
                        },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setDietType(option.value);
                            setIsDietDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-3 transition-all text-left border-b border-gray-100 last:border-b-0 ${
                            dietType === option.value
                              ? "bg-green-50 text-green-900"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-base">
                                {option.label}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {option.desc}
                              </div>
                            </div>
                            {dietType === option.value && (
                              <svg
                                className="w-5 h-5 text-green-600 flex-shrink-0 ml-2"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
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
              disabled={isSaving}
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
