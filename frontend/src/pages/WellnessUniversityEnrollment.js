import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { debugLog } from '../shared/utils/logger.js';
import {
  Salad,
  TrendingDown,
  TrendingUp,
  Baby,
  Dumbbell,
  Target,
  Coins,
  Briefcase,
} from "lucide-react";
import { TeamMemberSearch } from '../features/team';

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

const PROGRAM_ICON_MAP = {
  "family-breakfast":  { Icon: Salad,        color: "text-green-500",  bg: "bg-green-50"  },
  "weight-loss":       { Icon: TrendingDown,  color: "text-red-500",    bg: "bg-red-50"    },
  "weight-gain":       { Icon: TrendingUp,    color: "text-blue-500",   bg: "bg-blue-50"   },
  "kids-nutrition":    { Icon: Baby,          color: "text-yellow-500", bg: "bg-yellow-50" },
  "sports-nutrition":  { Icon: Dumbbell,      color: "text-orange-500", bg: "bg-orange-50" },
  "targeted-nutrition":{ Icon: Target,        color: "text-purple-500", bg: "bg-purple-50" },
  "earn-product-cost": { Icon: Coins,         color: "text-amber-500",  bg: "bg-amber-50"  },
  "extra-income":      { Icon: Briefcase,     color: "text-teal-500",   bg: "bg-teal-50"   },
};

const PROGRAMS = [
  {
    id: "family-breakfast",
    name: "Family Healthy Breakfast Programme",
    description: "(Family / Friends 3 Days Trial)",
    icon: "🥗",
  },
  {
    id: "weight-loss",
    name: "Weight Loss",
    description:
      "(30-Days Weight Loss Challenge / Weight Loss Marathon / Fitness Camp / Personal Coaching / Diet Chart)",
    icon: "📉",
  },
  {
    id: "weight-gain",
    name: "Weight Gain",
    description:
      "(30-Days Weight Gain Challenge / Healthy Snack Ideas / Diet Chart / Recognition)",
    icon: "📈",
  },
  {
    id: "kids-nutrition",
    name: "Kids Nutrition",
    description: "(Healthy Snacks Ideas / Kids Wellness Evaluation)",
    icon: "🧒",
  },
  {
    id: "sports-nutrition",
    name: "Sports Nutrition",
    description: "(Pre & Post Workout Nutrition)",
    icon: "🏃",
  },
  {
    id: "targeted-nutrition",
    name: "Targeted Nutrition",
    description:
      "(Heart Health / Digestive Health / Joint Health / Skin Health)",
    icon: "🎯",
  },
  {
    id: "earn-product-cost",
    name: "How to Earn My Product Cost",
    description: "",
    icon: "💰",
  },
  {
    id: "extra-income",
    name: "Extra Income Opportunity",
    description: "(Part Time / Full Time)",
    icon: "💼",
  },
];

const WellnessUniversityEnrollment = ({ onBack, user, userRole }) => {
  // onBack is the canonical prop name (matches App.js). Alias kept for clarity.
  const onClose = onBack;
  // Use SVG icons only on iOS (emoji renders as ? in iOS WebView)
  const isIOS = Capacitor.getPlatform() === "ios";

  // Coach/upline/admin can search for and view a team member's enrollment
  const isCoachRole = ['coach', 'upline', 'admin', 'developer'].includes(String(userRole || '').toLowerCase());
  const [selectedMember, setSelectedMember] = useState(null);

  // Use userId as the primary key for enrollment lookups — more reliable than
  // email, which can be an empty string when the team hierarchy API returns no
  // Email for the user (mapped as `member.Email || ""` in getFlatTeamList).
  const viewedUserId = (selectedMember && !selectedMember.isSelf)
    ? (selectedMember.id || selectedMember.userId)
    : user?.id;
  const isViewingOther = Boolean(selectedMember && !selectedMember.isSelf);

  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [existingEnrollment, setExistingEnrollment] = useState(null);
  const [checkingEnrollment, setCheckingEnrollment] = useState(true);
  const [coachName, setCoachName] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);

  const checkExistingEnrollment = useCallback(async () => {
    if (!viewedUserId) {
      setCheckingEnrollment(false);
      return;
    }

    try {
      // Fetch user profile to get coach name (only for own profile)
      if (!isViewingOther) {
        const cacheBuster = Date.now();
        const profileResponse = await fetch(
          `${API_BASE}/api/user/profile?email=${encodeURIComponent(
            user?.email || '',
          )}&_t=${cacheBuster}`,
        );
        const profileData = await profileResponse.json();

        debugLog("🎓 [Enrollment] Profile data:", profileData);

        if (profileData.success && profileData.data?.coachName) {
          debugLog(
            "✅ [Enrollment] Coach name found:",
            profileData.data.coachName,
          );
          setCoachName(profileData.data.coachName);
        } else {
          debugLog("⚠️ [Enrollment] No coach name in profile data");
          setCoachName("");
        }
      } else {
        setCoachName("");
      }

      // Check existing enrollment — use userId as the primary key.
      const cacheBuster = Date.now();
      const response = await fetch(
        `${API_BASE}/api/wellness-university/get-enrollments?userId=${encodeURIComponent(
          viewedUserId,
        )}&userOnly=true&_t=${cacheBuster}`,
      );
      const data = await response.json();

      if (data.success && data.enrollments && data.enrollments.length > 0) {
        const enrollment = data.enrollments[0];
        setExistingEnrollment(enrollment);
        // Load existing programs for editing
        const _parsed = JSON.parse(enrollment.EnrolledPrograms || "[]");
        const enrolledPrograms = Array.isArray(_parsed) ? _parsed : Object.keys(_parsed);
        setSelectedPrograms(enrolledPrograms);
      } else {
        setExistingEnrollment(null);
        setSelectedPrograms([]);
      }
    } catch (err) {
      console.error("Error checking enrollment:", err);
    } finally {
      setCheckingEnrollment(false);
    }
  }, [viewedUserId, isViewingOther, user?.email]);

  useEffect(() => {
    setCheckingEnrollment(true);
    checkExistingEnrollment();
  }, [checkExistingEnrollment]);

  const handleProgramToggle = (programName) => {
    setSelectedPrograms((prev) =>
      prev.includes(programName)
        ? prev.filter((p) => p !== programName)
        : [...prev, programName],
    );
  };

  const handleSubmit = async () => {
    if (selectedPrograms.length === 0) {
      setError("Please select at least one program");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const endpoint = existingEnrollment
        ? `${API_BASE}/api/wellness-university/update-enrollment`
        : `${API_BASE}/api/wellness-university/enroll`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: viewedUserId,
          programs: selectedPrograms,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        // Wait for success message, then refresh
        setTimeout(async () => {
          if (existingEnrollment) {
            // Clear existing state first to force fresh fetch
            setExistingEnrollment(null);
            setSelectedPrograms([]);
            // Small delay to ensure backend has committed changes
            await new Promise((resolve) => setTimeout(resolve, 500));
            // Refresh enrollment data with fresh fetch
            await checkExistingEnrollment();
            setSuccess(false);
          } else {
            onClose();
          }
        }, 1500);
      } else {
        setError(data.message || "Failed to submit enrollment");
      }
    } catch (err) {
      console.error("Enrollment error:", err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingEnrollment) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center relative">
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 rounded-full p-1 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show enrollment form (new enrollment or edit mode)
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[95vh] overflow-hidden flex flex-col my-2 sm:my-8"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-400 to-green-400 p-4 sm:p-6 rounded-t-2xl flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                🎓 {existingEnrollment ? "Edit Enrollment" : "Enrollment"}
              </h2>
              <p className="text-white text-xs sm:text-sm mt-1">
                {existingEnrollment
                  ? "Update your selected programs"
                  : "Select programs you're interested in"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* Coach: member search to view a downline's enrollment */}
          {isCoachRole && (
            <div className="mb-4">
              <TeamMemberSearch
                user={user}
                userRole={userRole}
                selectedMember={selectedMember}
                onMemberSelect={setSelectedMember}
              />
            </div>
          )}

          {/* User Info */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs sm:text-sm text-gray-600 font-semibold">Name:</span>
              <span className="text-xs sm:text-sm text-gray-800 break-words">
                {isViewingOther
                  ? selectedMember?.name || selectedMember?.userName || selectedMember?.email?.split("@")[0]
                  : user?.displayName || user?.email?.split("@")[0]}
              </span>
            </div>
            {coachName && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs sm:text-sm text-gray-600 font-semibold">
                  Invited By:
                </span>
                <span className="text-xs sm:text-sm text-gray-800 break-words">{coachName}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-gray-600 font-semibold">Date:</span>
              <span className="text-xs sm:text-sm text-gray-800">
                {new Date().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Programs Grid */}
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                I would like more information about:
              </h3>

            </div>
            {PROGRAMS.map((program) => {
              const iconInfo = PROGRAM_ICON_MAP[program.id];
              const IconComp = iconInfo?.Icon;
              return (
              <div
                key={program.id}
                onClick={() => handleProgramToggle(program.name)}
                className={`flex items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedPrograms.includes(program.name)
                    ? "border-green-400 bg-gradient-to-r from-green-50 to-teal-50 shadow-md"
                    : "border-gray-200 hover:border-green-300 hover:bg-gray-50"
                }`}
              >
                <div
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    selectedPrograms.includes(program.name)
                      ? "border-green-500 bg-green-500"
                      : "border-gray-300"
                  }`}
                >
                  {selectedPrograms.includes(program.name) && (
                    <svg
                      className="w-3 h-3 sm:w-4 sm:h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                {isIOS ? (
                  IconComp ? (
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconInfo.bg}`}>
                      <IconComp className={`w-5 h-5 sm:w-6 sm:h-6 ${iconInfo.color}`} />
                    </div>
                  ) : (
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-green-50">
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  )
                ) : (
                  <span className="text-xl sm:text-2xl flex-shrink-0">{program.icon}</span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm sm:text-base text-gray-800 font-medium break-words">
                    {program.name}
                  </div>
                  {program.description && (
                    <div className="text-xs text-gray-500 mt-0.5 break-words">
                      {program.description}
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>

          {/* Error Message ,*/}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 text-center"
            >
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-green-800 font-semibold">
                {existingEnrollment ? "Enrollment Updated!" : "Enrollment Successful!"}
              </p>
              <p className="text-green-700 text-sm mt-1">
                {existingEnrollment
                  ? "Your programs have been updated."
                  : "Your coach will be notified."}
              </p>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 bg-gray-50 rounded-b-2xl flex-shrink-0">
          <div className="flex gap-2 sm:gap-3">
            {isViewingOther ? (
              <button
                onClick={() => setSelectedMember(null)}
                disabled={loading}
                className="flex-1 bg-gray-200 text-gray-700 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                ← Back to My Enrollment
              </button>
            ) : (
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 bg-gray-200 text-gray-700 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={loading || selectedPrograms.length === 0}
              className="flex-1 bg-gradient-to-r from-green-400 to-teal-400 text-white py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  {existingEnrollment ? "Updating..." : "Submitting..."}
                </span>
              ) : existingEnrollment ? (
                `✓ Update (${selectedPrograms.length} selected)`
              ) : (
                `Enroll (${selectedPrograms.length} selected)`
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default WellnessUniversityEnrollment;
