import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { TeamMemberSearch } from '../features/team';
import { EmojiOrNative } from '../shared/components/icons/EmojiImage';
import { getProfile } from '../features/user/services/user.api.js';
import { getApiBaseUrl } from '../config/api.config.js';

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

const WellnessUniversityEnrollment = ({ onBack, user, userRole, embedded = false, tabVisitKey = 0 }) => {
  // onBack is the canonical prop name (matches App.js). Alias kept for clarity.
  const onClose = onBack;

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
  const loadGenRef = useRef(0);

  const checkExistingEnrollment = useCallback(async () => {
    if (!viewedUserId) {
      setCheckingEnrollment(false);
      return;
    }

    const generation = ++loadGenRef.current;
    const apiBase = getApiBaseUrl();

    try {
      // Coach name + enrollment in parallel.
      // getProfile is shared/deduped with TeamMemberSearch — no cache-bust, so
      // Strict Mode remounts and search do not double-hit the 30KB profile payload.
      const profilePromise = (!isViewingOther && user?.email)
        ? getProfile(user.email).catch(() => null)
        : Promise.resolve(null);

      const enrollmentPromise = fetch(
        `${apiBase}/api/wellness-university/get-enrollments?userId=${encodeURIComponent(
          viewedUserId,
        )}&userOnly=true`,
      ).then((res) => res.json());

      const [profileData, data] = await Promise.all([profilePromise, enrollmentPromise]);
      if (generation !== loadGenRef.current) return;

      if (!isViewingOther) {
        const name = profileData?.success
          ? (profileData.data?.coachName || profileData.data?.sponsorName || '')
          : '';
        setCoachName(name);
      } else {
        setCoachName("");
      }

      if (data.success && data.enrollments && data.enrollments.length > 0) {
        const enrollment = data.enrollments[0];
        setExistingEnrollment(enrollment);
        const _parsed = JSON.parse(enrollment.EnrolledPrograms || "[]");
        const enrolledPrograms = Array.isArray(_parsed) ? _parsed : Object.keys(_parsed);
        setSelectedPrograms(enrolledPrograms);
      } else {
        setExistingEnrollment(null);
        setSelectedPrograms([]);
      }
    } catch (err) {
      if (generation !== loadGenRef.current) return;
      console.error("Error checking enrollment:", err);
    } finally {
      if (generation === loadGenRef.current) setCheckingEnrollment(false);
    }
  }, [viewedUserId, isViewingOther, user?.email]);

  // Debounce collapses React Strict Mode remount into one request pair.
  useEffect(() => {
    setCheckingEnrollment(true);
    const timer = setTimeout(() => {
      checkExistingEnrollment();
    }, 50);
    return () => {
      clearTimeout(timer);
      loadGenRef.current += 1;
    };
  }, [checkExistingEnrollment, tabVisitKey]);

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

    const programsSnapshot = [...selectedPrograms];
    const wasUpdate = Boolean(existingEnrollment);

    try {
      const endpoint = wasUpdate
        ? `${getApiBaseUrl()}/api/wellness-university/update-enrollment`
        : `${getApiBaseUrl()}/api/wellness-university/enroll`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: viewedUserId,
          programs: programsSnapshot,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Optimistic local state — no full-screen reload / delayed refetch.
        if (wasUpdate) {
          setExistingEnrollment((prev) => ({
            ...(prev || {}),
            EnrolledPrograms: JSON.stringify(
              Object.fromEntries(programsSnapshot.map((p) => [p, new Date().toISOString()])),
            ),
            LastUpdated: new Date().toISOString(),
          }));
          setSelectedPrograms(programsSnapshot);
          setIsEditMode(false);
          setSuccess(true);
          setTimeout(() => setSuccess(false), 1200);
        } else {
          setSuccess(true);
          setTimeout(() => {
            onClose?.();
          }, 1000);
        }
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
  const panelClass = embedded
    ? 'bg-white w-full min-h-full flex flex-col'
    : 'bg-white rounded-2xl shadow-2xl w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1rem)] overflow-hidden flex flex-col my-2 sm:my-8';

  const formPanel = (
    <motion.div
      initial={embedded ? false : { opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={panelClass}
    >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-400 to-green-400 p-3 xs:p-4 sm:p-6 rounded-t-2xl flex-shrink-0 safe-top">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-base xs:text-lg sm:text-2xl font-bold text-white flex items-center gap-2 flex-wrap">
                <EmojiOrNative emoji="🎓" className="w-5 h-5 xs:w-6 xs:h-6 sm:w-7 sm:h-7 flex-shrink-0" nativeClassName="text-base xs:text-lg sm:text-2xl" />
                <span className="break-words">{existingEnrollment ? "Programmers enrolled" : " Programmers Enrollment"}</span>
              </h2>
              {/* <p className="text-white text-[11px] xs:text-xs sm:text-sm mt-1">
                {existingEnrollment
                  ? "Update your selected programs"
                  : "Select programs you're interested in"}
              </p> */}
            </div>
            {!embedded && (
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors flex-shrink-0"
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
            )}
          </div>
        </div>

        {/* Form Content */}
        <div className="p-3 xs:p-4 sm:p-6 overflow-y-auto flex-1 ios-scroll-body">
          {/* Coach / admin / anyone with team_table downline: member search */}
          <div className="mb-4">
            <TeamMemberSearch
              user={user}
              userRole={userRole}
              selectedMember={selectedMember}
              onMemberSelect={setSelectedMember}
            />
          </div>

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
            {PROGRAMS.map((program) => (
              <div
                key={program.id}
                onClick={() => handleProgramToggle(program.name)}
                className={`ios-list-row p-2.5 xs:p-3 sm:p-4 rounded-xl border-2 transition-all cursor-pointer ${
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
                <EmojiOrNative
                  emoji={program.icon}
                  className="w-5 h-5 xs:w-6 xs:h-6 sm:w-7 sm:h-7"
                  nativeClassName="text-lg xs:text-xl sm:text-2xl"
                />
                <div className="min-w-0">
                  <div className="text-[13px] xs:text-sm sm:text-base text-gray-800 font-medium break-words leading-snug">
                    {program.name}
                  </div>
                  {program.description && (
                    <div className="text-[11px] xs:text-xs text-gray-500 mt-0.5 break-words leading-snug">
                      {program.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
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
                  : "Your sponsor will be notified."}
              </p>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 xs:p-4 sm:p-6 bg-gray-50 rounded-b-2xl flex-shrink-0 safe-bottom">
          <div className="flex flex-col xxs:flex-row gap-2 sm:gap-3">
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
  );

  if (embedded) {
    return formPanel;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 xs:p-4 overflow-y-auto safe-top safe-bottom">
      {formPanel}
    </div>
  );
};

export default WellnessUniversityEnrollment;
