// src/components/CompleteProfilePage.js
// Full-screen blocking page shown when mandatory profile fields are missing.
// The user cannot close or bypass this page until all required fields are saved.
import React, { useEffect, useState } from "react";
import { User, Ruler, CheckCircle2, Phone } from "lucide-react";

const DIET_OPTIONS = [
  { value: "Vegetarian", label: "🌱 Vegetarian" },
  { value: "Non-Vegetarian", label: "🍗 Non-Vegetarian" },
  { value: "Vegan", label: "🥦 Vegan" },
  { value: "Pescatarian", label: "🐟 Pescatarian" },
];

/**
 * CompleteProfilePage
 * Full-screen blocking component that forces users to fill mandatory profile
 * fields before they can access any other part of the app.
 *
 * Required fields: Height, Phone Number, Diet Type
 *
 * Props:
 *   user       - authenticated user object (must have .email)
 *   apiBaseUrl - base URL for backend API calls
 *   onComplete - callback invoked after successful save
 */
const CompleteProfilePage = ({ user, apiBaseUrl, onComplete }) => {
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

      console.log("✅ [CompleteProfilePage] Profile saved — unlocking app.");
      onComplete({
        height: missingFields.height ? parseFloat(height) : undefined,
        phoneNumber: missingFields.phoneNumber ? phone.trim() : undefined,
        dietType: missingFields.dietType ? dietType : undefined,
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

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={isLoadingProfile || !formValid || isSaving}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-all shadow-sm ${
            !isLoadingProfile && formValid && !isSaving
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

        <p className="text-xs text-gray-400 text-center">
          You can update these details anytime from your profile settings.
        </p>
      </div>
    </div>
  );
};

export default CompleteProfilePage;
