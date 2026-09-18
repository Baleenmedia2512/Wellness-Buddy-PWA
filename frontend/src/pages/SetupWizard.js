import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import wellnessValleyIcon from "../assets/wellness-valley-icon.png";
import { debugLog } from '../shared/utils/logger.js';
import { APP_VERSION } from "../config/version";
import * as Session from "../shared/services/sessionStorage.js";
import { getProfile } from "../features/user/services/user.api.js";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function looksLikeEmail(value) {
  return EMAIL_RE.test(String(value || "").trim());
}

function mapSetupApiError(raw, fallback) {
  const msg = String(raw || "").trim();
  if (/email is required/i.test(msg)) {
    return "Could not identify your account. Please re-login and try again.";
  }
  return msg || fallback;
}

/**
 * Sponsor selection only. Community ID is entered later on Home → Profile.
 */
const SetupWizard = ({
  onClose,
  onNavigateToOTP,
  onLogout,
  userEmail: userEmailProp = '',
  userId: userIdProp = null,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [coaches, setCoaches] = useState([]);
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [searching, setSearching] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const sendingRequestRef = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resolvedEmail, setResolvedEmail] = useState("");

  const resolveUserId = () =>
    userIdProp
    || Session.getDbUserId()
    || localStorage.getItem("userId")
    || localStorage.getItem("dbUserId")
    || null;

  const collectSessionEmail = () => {
    const otpUser = Session.getOtpUser();
    const candidates = [
      resolvedEmail,
      userEmailProp,
      Session.getUserEmail(),
      localStorage.getItem("userEmail"),
      otpUser?.email,
      otpUser?.Email,
    ];
    return candidates.map((v) => String(v || "").trim()).find(looksLikeEmail) || "";
  };

  const persistEmail = (email) => {
    const clean = String(email || "").trim();
    if (!looksLikeEmail(clean)) return;
    setResolvedEmail(clean);
    try {
      Session.setUserEmail(clean);
    } catch {
      /* ignore */
    }
    const otpUser = Session.getOtpUser();
    if (otpUser) {
      Session.setOtpUser({ ...otpUser, email: clean });
    }
  };

  const resolveRequester = () => {
    const email = collectSessionEmail();
    const userId = resolveUserId();
    return { email, userId };
  };

  const maskEmail = (email) => {
    if (!email) return "";
    const [username, domain] = email.split("@");
    if (!domain) return email;
    const visibleChars = Math.min(3, Math.floor(username.length / 2));
    const masked = username.substring(0, visibleChars) + "***";
    return `${masked}@${domain}`;
  };

  useEffect(() => {
    let cancelled = false;
    const hydrateEmail = async () => {
      const fromSession = collectSessionEmail();
      if (fromSession) {
        persistEmail(fromSession);
        return;
      }
      const userId = resolveUserId();
      if (!userId) return;
      try {
        const data = await getProfile({ userId: String(userId) });
        const fromProfile = String(data?.data?.email || data?.data?.Email || "").trim();
        if (!cancelled && looksLikeEmail(fromProfile)) {
          persistEmail(fromProfile);
        }
      } catch {
        /* profile may not have email yet */
      }
    };
    hydrateEmail();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmailProp, userIdProp]);

  // Demo account: auto-select Yasheer J and send request
  const DEMO_EMAIL = 'testereasywork@gmail.com';
  useEffect(() => {
    const userEmail = collectSessionEmail() || userEmailProp || localStorage.getItem('userEmail') || '';
    if (userEmail.toLowerCase().trim() !== DEMO_EMAIL) return;

    const autoComplete = async () => {
      try {
        const response = await axios.get(
          `${API_BASE}/api/users/search?q=Yasheer J&email=${encodeURIComponent(userEmail)}`
        );
        const list = response.data.coaches || [];
        const yasheer = list.find(c =>
          c.userName.toLowerCase().includes('yasheer')
        );
        if (!yasheer) {
          console.error('[SetupWizard] Yasheer J not found in search results');
          return;
        }

        setSelectedCoach(yasheer);
        setCoaches([yasheer]);
        setSearchQuery('Yasheer J');

        await axios.post(
          `${API_BASE}/api/upline/request`,
          { coachId: yasheer.userId, email: userEmail }
        );
        debugLog('✅ [Demo] Upline request sent automatically');

        if (onNavigateToOTP) {
          onNavigateToOTP();
        } else if (onClose) {
          onClose();
        }
      } catch (err) {
        console.error('[SetupWizard] Demo auto-complete failed:', err);
      }
    };

    autoComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setCoaches([]);
      setError("");
      return;
    }

    const delaySearch = setTimeout(() => {
      searchCoaches(searchQuery);
    }, 500);

    return () => clearTimeout(delaySearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const searchCoaches = async (query) => {
    setSearching(true);
    setError("");

    try {
      const { email: userEmail } = resolveRequester();
      const response = await axios.get(
        `${API_BASE}/api/users/search?q=${encodeURIComponent(
          query,
        )}&email=${encodeURIComponent(userEmail || "")}`,
      );

      setCoaches(response.data.coaches || []);
    } catch (err) {
      console.error(err);
      setCoaches([]);
    } finally {
      setSearching(false);
    }
  };

  const sendSponsorRequest = async () => {
    if (sendingRequestRef.current) return;
    if (!selectedCoach) {
      setError("Please select a guide first");
      return;
    }

    sendingRequestRef.current = true;
    setSendingRequest(true);
    setError("");

    try {
      const { email: userEmail, userId } = resolveRequester();
      if (!userEmail && !userId) {
        setError("Could not identify your account. Please re-login and try again.");
        return;
      }

      debugLog("Sending sponsor approval request:", {
        coachId: selectedCoach.userId,
        coachName: selectedCoach.userName,
        email: userEmail || null,
        userId: userId || null,
      });

      const requestBody = { coachId: selectedCoach.userId };
      if (userEmail) requestBody.email = userEmail;
      if (userId) requestBody.userId = userId;

      const requestResponse = await axios.post(
        `${API_BASE}/api/upline/request`,
        requestBody,
      );

      debugLog("Approval request sent:", requestResponse.data);
      setSuccess("Request sent!");
      if (onNavigateToOTP) {
        onNavigateToOTP();
      } else if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error("Setup error:", err);
      setError(mapSetupApiError(err.response?.data?.error || err.message, "Failed to send request"));
    } finally {
      sendingRequestRef.current = false;
      setSendingRequest(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center overflow-hidden">
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
            <div className="min-w-0 text-left">
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                Welcome Wellness Valley
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">v{APP_VERSION.VERSION}</p>
            </div>
          </div>
        </div>

        <div className="px-8 pb-8 flex-1 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key="sponsor"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-900 mb-3 leading-snug">
                  Search and select the person name (sponsor) who invited you to this program
                </h3>
                

                <div className="relative group">
                  <input
                    type="text"
                    className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-green-500 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-green-500/10 transition-all shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type your sponsor name or email..."
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
                        ? "No sponsors found"
                        : "Start typing to search..."}
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <p className="text-red-500 text-xs mb-3 text-center">{error}</p>
              )}
              {success && (
                <p className="text-green-600 text-xs mb-3 text-center">{success}</p>
              )}

              <button
                className={`w-full py-3.5 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                  selectedCoach && !sendingRequest
                    ? "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
                onClick={sendSponsorRequest}
                disabled={!selectedCoach || sendingRequest}
              >
                {sendingRequest ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <span>Continue</span>
                )}
              </button>

              {typeof onLogout === "function" && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full mt-3 py-2 text-sm text-gray-500 underline"
                >
                  Sign out
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default SetupWizard;
