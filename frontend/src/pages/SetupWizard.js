import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import wellnessValleyIcon from "../assets/wellness-valley-icon.png";
import { debugLog } from '../shared/utils/logger.js';

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

const SetupWizard = ({ onClose, onNavigateToOTP, onLogout }) => {
  // Step 1: Coach Search, Step 2: Team ID
  const [step, setStep] = useState(1);

  // Step 1: Coach Search
  const [searchQuery, setSearchQuery] = useState("");
  const [coaches, setCoaches] = useState([]);
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [searching, setSearching] = useState(false);

  // Step 2: Team ID
  const [teamId, setTeamId] = useState("");
  const [teamIdStatus, setTeamIdStatus] = useState(null); // 'new', 'available', 'taken', 'taken-by-you'
  const [teamIdInfo, setTeamIdInfo] = useState(null); // Store additional info like existingCoach
  const [checkingTeamId, setCheckingTeamId] = useState(false);
  const [claimingTeamId, setClaimingTeamId] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);

  // General
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Mask email function
  const maskEmail = (email) => {
    if (!email) return "";
    const [username, domain] = email.split("@");
    if (!domain) return email;
    const visibleChars = Math.min(3, Math.floor(username.length / 2));
    const masked = username.substring(0, visibleChars) + "***";
    return `${masked}@${domain}`;
  };

  // Format Team ID as user types (auto-uppercase)
  const formatTeamId = (value) => {
    const cleaned = value
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    return cleaned.slice(0, 10);
  };

  // Validate Team ID format
  const isValidTeamIdFormat = (id) => {
    return /^[a-zA-Z0-9]{10}$/.test(id);
  };

  const DEMO_EMAIL = 'testereasywork@gmail.com';

  // ── Demo account: auto-select Yasheer J, skip Team ID, send request ───────
  useEffect(() => {
    const userEmail = localStorage.getItem('userEmail') || '';
    if (userEmail.toLowerCase().trim() !== DEMO_EMAIL) return;

    const autoComplete = async () => {
      try {
        // Step 1: search for Yasheer J
        const response = await axios.get(
          `${API_BASE}/api/users/search?q=Yasheer J&email=${encodeURIComponent(userEmail)}`
        );
        const coaches = response.data.coaches || [];
        const yasheer = coaches.find(c =>
          c.userName.toLowerCase().includes('yasheer')
        );
        if (!yasheer) {
          console.error('[SetupWizard] Yasheer J not found in search results');
          return;
        }

        setSelectedCoach(yasheer);
        setCoaches([yasheer]);
        setSearchQuery('Yasheer J');

        // Step 2: auto send the upline request (skip Team ID)
        const requestResponse = await axios.post(
          `${API_BASE}/api/upline/request`,
          { coachId: yasheer.userId, email: userEmail }
        );
        debugLog('✅ [Demo] Upline request sent automatically:', requestResponse.data);

        // Step 3: navigate to OTP screen
        if (onNavigateToOTP) {
          onNavigateToOTP();
        } else if (onClose) {
          onClose();
        }
      } catch (err) {
        console.error('[SetupWizard] Demo auto-complete failed:', err);
        // Fallback: show Step 2 with Yasheer J pre-selected
        setStep(2);
      }
    };

    autoComplete();
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  // Real-time search with debounce
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setCoaches([]);
      setError("");
      return;
    }

    const delaySearch = setTimeout(() => {
      searchCoaches(searchQuery);
    }, 500); // 500ms debounce

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  // Search coaches
  const searchCoaches = async (query) => {
    setSearching(true);
    setError("");

    try {
      const userEmail = localStorage.getItem("userEmail");
      const response = await axios.get(
        `${API_BASE}/api/users/search?q=${encodeURIComponent(
          query,
        )}&email=${encodeURIComponent(userEmail || "")}`,
      );

      setCoaches(response.data.coaches);

      if (response.data.coaches.length === 0) {
        // Don't show error immediately, just empty list
      }
    } catch (err) {
      console.error(err);
      setCoaches([]);
    } finally {
      setSearching(false);
    }
  };

  // Check Team ID availability
  const checkTeamIdAvailability = async () => {
    if (!isValidTeamIdFormat(teamId)) {
      setError("Team ID must be exactly 10 alphanumeric characters");
      setTeamIdStatus(null);
      return;
    }

    setCheckingTeamId(true);
    setError("");

    try {
      const userEmail = localStorage.getItem("userEmail");
      if (!userEmail) {
        setError("Session expired. Please login again.");
        return;
      }

      const response = await axios.get(
        `${API_BASE}/api/team/check-availability?teamId=${teamId}&email=${encodeURIComponent(
          userEmail,
        )}`,
      );

      setTeamIdStatus(response.data.status);
      setTeamIdInfo(response.data);

      if (response.data.status === "taken-by-you") {
        setSuccess("You already own this ID.");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to check Team ID");
      setTeamIdStatus(null);
    } finally {
      setCheckingTeamId(false);
    }
  };

  // Skip Team ID - Send approval request WITHOUT claiming Team ID (but still requires OTP)
  const skipTeamIdAndSendRequest = async () => {
    if (!selectedCoach) {
      setError("Please select a coach first");
      return;
    }

    setSendingRequest(true);
    setError("");

    try {
      const userEmail = localStorage.getItem("userEmail");
      if (!userEmail) {
        setError("Session expired. Please login again.");
        setSendingRequest(false);
        return;
      }

      debugLog(
        "⏭️ Skipping Team ID - Sending approval request WITHOUT Team ID:",
        {
          coachId: selectedCoach.userId,
          coachName: selectedCoach.userName,
          email: userEmail,
        },
      );

      // Send approval request directly WITHOUT claiming Team ID
      // Backend will generate OTP and send to coach
      const requestResponse = await axios.post(
        `${API_BASE}/api/upline/request`,
        { coachId: selectedCoach.userId, email: userEmail },
      );

      debugLog("Approval request sent (no Team ID):", requestResponse.data);

      setSuccess(`Request sent!`);

      // Navigate to OTP validation after delay
      setTimeout(() => {
        if (onNavigateToOTP) {
          onNavigateToOTP();
        } else if (onClose) {
          onClose();
        }
      }, 1500);
    } catch (err) {
      console.error("Skip setup error:", err);
      console.error("Error response:", err.response?.data);
      const errorMessage =
        err.response?.data?.error || err.message || "Failed to send request";
      setError(errorMessage);
      setSendingRequest(false);
    }
  };

  // Claim Team ID and send approval request
  const claimTeamIdAndSendRequest = async () => {
    if (!selectedCoach) {
      setError("Please select a coach first");
      return;
    }

    setClaimingTeamId(true);
    setError("");

    try {
      const userEmail = localStorage.getItem("userEmail");
      if (!userEmail) {
        setError("Session expired. Please login again.");
        setClaimingTeamId(false);
        return;
      }

      debugLog("Claiming Team ID:", { teamId, email: userEmail });

      // Step 1: Claim Team ID
      const claimResponse = await axios.post(`${API_BASE}/api/team/claim-id`, {
        teamId,
        email: userEmail,
      });

      debugLog("Team ID claimed successfully:", claimResponse.data);

      debugLog("Sending approval request:", {
        coachId: selectedCoach.userId,
        email: userEmail,
      });

      // Step 2: Send approval request to coach
      const requestResponse = await axios.post(
        `${API_BASE}/api/upline/request`,
        { coachId: selectedCoach.userId, email: userEmail },
      );

      debugLog("Approval request sent:", requestResponse.data);

      setSuccess(`Request sent!`);

      // Navigate to OTP validation after delay
      setTimeout(() => {
        if (onNavigateToOTP) {
          onNavigateToOTP();
        } else if (onClose) {
          onClose();
        }
      }, 1500);
    } catch (err) {
      console.error("Setup error:", err);
      console.error("Error response:", err.response?.data);
      const errorMessage =
        err.response?.data?.error || err.message || "Failed to complete setup";
      setError(errorMessage);
      setClaimingTeamId(false);
    }
  };

  // Auto-check Team ID when user types
  useEffect(() => {
    if (teamId.length === 10 && isValidTeamIdFormat(teamId)) {
      const timer = setTimeout(() => {
        checkTeamIdAvailability();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setTeamIdStatus(null);
    }
  }, [teamId]);

  return (
    <div className="fixed inset-0 z-[9999] bg-green-900/40 backdrop-blur-sm flex items-center justify-center sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full h-full sm:h-auto sm:max-w-md bg-white sm:rounded-[2rem] shadow-2xl overflow-hidden relative flex flex-col"
      >
        {/* Logout Button */}
        <button
          onClick={onLogout}
          className="absolute right-4 top-4 z-10 text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
          title="Log Out"
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
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </button>

        <div className="shrink-0">
          {/* Header Icon */}
          <div className="flex justify-center pt-8 pb-4">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden">
              <img
                src={wellnessValleyIcon}
                alt="Wellness Valley"
                className="w-full h-full object-contain brand-logo"
                draggable="false"
                style={{
                  WebkitUserSelect: "none",
                  userSelect: "none",
                  WebkitTouchCallout: "none",
                  WebkitUserDrag: "none",
                }}
              />
            </div>
          </div>

          <div className="px-8 text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome to Wellness Valley
            </h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              Search for the person who invited you and activate your account.
            </p>
          </div>

        </div>

        <div className="px-8 pb-8 flex-1 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-6">
                  {/* find your coach */}
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    Person who invited you for this Program
                  </h3>
                  {/* <p className="text-gray-500 text-sm mb-4">Search for the person who invited you to Wellness Valley. They will be your mentor.</p> */}

                  <div className="relative group">
                    <input
                      type="text"
                      className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-green-500 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-green-500/10 transition-all shadow-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Type your coach name or email..."
                      autoFocus
                    />
                    <svg
                      className="absolute left-4 top-4 w-5 h-5 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    {searching && (
                      <div className="absolute right-4 top-4">
                        <div className="animate-spin h-5 w-5 border-2 border-green-500 border-t-transparent rounded-full"></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Results or Empty State */}
                <div className="min-h-[80px] mb-4">
                  {coaches.length > 0 ? (
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar p-1">
                      {coaches.map((coach) => (
                        <div
                          key={coach.userId}
                          onClick={() => setSelectedCoach(coach)}
                          className={`p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 border ${
                            selectedCoach?.userId === coach.userId
                              ? "bg-green-50 border-green-500 shadow-md shadow-green-100"
                              : "bg-white border-gray-100 shadow-sm hover:border-green-200 hover:shadow-md"
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                              selectedCoach?.userId === coach.userId
                                ? "bg-green-500 text-white"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {coach.userName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900 truncate">
                              {coach.userName}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {maskEmail(coach.email)}
                            </div>
                          </div>
                          {selectedCoach?.userId === coach.userId && (
                            <div className="text-green-500 bg-white rounded-full p-1 shadow-sm">
                              <svg
                                className="w-5 h-5"
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
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm p-4 text-center">
                      <p>
                        {searchQuery.length > 1 && !searching
                          ? "No coaches found"
                          : "Start typing to search..."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Info Box Removed */}

                <button
                  className={`w-full py-3.5 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                    selectedCoach && !sendingRequest
                      ? "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                  onClick={() => selectedCoach && skipTeamIdAndSendRequest()}
                  disabled={!selectedCoach || sendingRequest}
                >
                  {sendingRequest ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                    </>
                  )}
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default SetupWizard;
