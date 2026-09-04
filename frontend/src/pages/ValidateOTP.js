import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import wellnessValleyIcon from '../assets/wellness-valley-icon.png';
import useOtpInput from '../features/user/hooks/useOtpInput';
import { EMAIL_OTP_LENGTH } from '../features/user/domain/otpLength';
import useWebOtp from '../features/user/hooks/useWebOtp';
import storage from '../shared/lib/storage';
import { debugLog } from '../shared/utils/logger';
import OtpInputCells from '../shared/components/OtpInputCells.jsx';
import { getStatus } from '../features/user/services/user.api.js';
import { isAppUpdateRequiredResponse } from '../shared/services/appVersionEnforce.client.js';

const API_BASE = process.env.REACT_APP_API_BASE_URL;
const DEMO_EMAIL = 'testereasywork@gmail.com';

const ValidateOTP = ({
  onClose,
  onSuccess,
  onLogout,
  isReactivationFlow = false,
  userEmail: userEmailProp = '',
  userId: userIdProp = null,
  coachName: _coachNameProp = '',
}) => {
  // Canonical OTP input controller — handles change, keydown, paste, iOS autofill, fillAll.
  const otpCtl = useOtpInput(EMAIL_OTP_LENGTH);
  const { refs, value: otpValue, isComplete, fillAll, reset: resetOtp } = otpCtl;
  const [validating, setValidating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requestInfo, setRequestInfo] = useState(null);
  const [otpExpired, setOtpExpired] = useState(false);
  const [resending, setResending] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const isReactivationFlowRef = useRef(isReactivationFlow);
  const validatingRef = useRef(false);

  useEffect(() => {
    isReactivationFlowRef.current = isReactivationFlow;
  }, [isReactivationFlow]);

  // Component mount/unmount logging
  useEffect(() => {
    debugLog("🟦 [ValidateOTP] Component MOUNTED", { isReactivationFlow });
    const mountTime = Date.now();
    return () => {
      const duration = ((Date.now() - mountTime) / 1000).toFixed(2);
      debugLog(`🟦 [ValidateOTP] Component UNMOUNTED (was visible for ${duration}s)`);
    };
  }, [isReactivationFlow]);

  // Auto-focus first cell on mount so the keyboard appears immediately and iOS
  // QuickType can surface the OTP suggestion without an extra tap.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => refs.current[0]?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  // Fetch request info on load
  useEffect(() => {
    console.log("🟦 [ValidateOTP] Fetching request info...", { isReactivationFlow });
    
    // For reactivation flow, ensure OTP is completely clear
    if (isReactivationFlow) {
      debugLog("🟦 [ValidateOTP] Reactivation flow - clearing OTP");
      resetOtp();
      setError('');
      setSuccess('');
    }
    
    fetchRequestInfo();
  }, [isReactivationFlow]); // eslint-disable-line react-hooks/exhaustive-deps

  // Demo account: auto-fill 0000 — verification runs via isComplete effect below.
  useEffect(() => {
    if (isReactivationFlow) return;
    const userEmail = userEmailProp || storage.get('userEmail') || '';
    if (userEmail.toLowerCase().trim() !== DEMO_EMAIL) return;
    const timer = setTimeout(() => {
      debugLog("\ud83d\udfe6 [ValidateOTP] Demo account - auto-filling OTP");
      fillAll('0000');
    }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReactivationFlow]);

  // WebOTP API: auto-reads OTP from SMS on Android Chrome / Capacitor WebView.
  // iOS uses autoComplete="one-time-code" on the first input instead.
  const handleWebOtpReceived = useCallback((code) => {
    fillAll(code);
  }, [fillAll]);
  useWebOtp(handleWebOtpReceived, !validating && !success);
  // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const fetchRequestInfo = async () => {
    if (isReactivationFlowRef.current) {
      debugLog("\ud83d\udfe6 [ValidateOTP] Reactivation flow — skipping status pre-check");
      return;
    }

    try {
      const userEmail = userEmailProp || storage.get('userEmail');
      const userId = userIdProp
        || storage.get('userId')
        || storage.get('dbUserId')
        || null;
      if (!userEmail && !userId) {
        setError('Session expired. Please login again.');
        return;
      }

      debugLog("\ud83d\udfe6 [ValidateOTP] Fetching user status from API...");
      const data = await getStatus(userEmail ? { email: userEmail } : { userId });
      if (isAppUpdateRequiredResponse(data)) return;

      debugLog("\ud83d\udfe6 [ValidateOTP] API Response:", data);

      if (data.pendingRequest) {
        const request = data.pendingRequest;
        debugLog("\ud83d\udfe6 [ValidateOTP] Request info loaded:", request);
        setRequestInfo(request);
        if (request.expired || data.pendingRequestExpired) {
          setOtpExpired(true);
          setError('This code expired. Ask your coach for a new one.');
        } else {
          setOtpExpired(false);
        }
      } else if (isReactivationFlowRef.current) {
        debugLog("\ud83d\udfe6 [ValidateOTP] Reactivation flow \u2014 no pendingRequest returned, staying open");
      } else {
        setError('No pending verification found. You can go back and select your coach again.');
      }
    } catch (err) {
      console.error("\ud83d\udd34 [ValidateOTP] Error fetching request info:", err);
      if (isReactivationFlowRef.current) {
        debugLog("\ud83d\udfe6 [ValidateOTP] Reactivation flow \u2014 ignoring fetch error, staying open");
      } else {
        setError('Could not load verification status. Check your connection and try again.');
      }
    }
  };

  // Validate OTP — accepts an explicit code so WebOTP / paste / fillAll callers
  // can pass the value synchronously without relying on async state updates.
  const validateOtp = async (otpCodeArg) => {
    if (validatingRef.current) return;

    const otpCode = typeof otpCodeArg === 'string' ? otpCodeArg : otpValue;
    debugLog("\ud83d\udfe6 [ValidateOTP] Validating OTP (length):", otpCode.length);

    if (otpCode.length !== EMAIL_OTP_LENGTH) {
      setError(`Please enter all ${EMAIL_OTP_LENGTH} digits`);
      return;
    }

    validatingRef.current = true;
    setValidating(true);
    setError('');

    try {
      const userEmail = userEmailProp || storage.get('userEmail');
      const userId = userIdProp
        || storage.get('userId')
        || storage.get('dbUserId')
        || null;
      if (!userEmail && !userId) {
        setError('Session expired. Please login again.');
        return;
      }

      debugLog("\ud83d\udfe6 [ValidateOTP] Sending validation request to API...");
      const body = { otp: otpCode };
      if (userEmail) body.email = userEmail;
      else body.userId = userId;
      await axios.post(`${API_BASE}/api/upline/validate-otp`, body);

      debugLog("\u2705 [ValidateOTP] OTP verified successfully!");
      setSuccess('Verified!');
      storage.set('coachOtpVerified', 'true');

      setTimeout(() => {
        if (onSuccess) onSuccess();
        else if (onClose) onClose();
      }, 1500);
    } catch (err) {
      console.error("\ud83d\udd34 [ValidateOTP] Validation error:", err);
      const errorData = err.response?.data;

      if (errorData?.expired) {
        setOtpExpired(true);
        setError('Code expired. Please request a new one.');
      } else if (errorData?.attemptsLeft !== undefined) {
        setAttemptsLeft(errorData.attemptsLeft);
        setError(`Incorrect code. ${errorData.attemptsLeft} attempts left.`);
      } else {
        setError(errorData?.error || 'Verification failed');
      }

      resetOtp();
      refs.current[0]?.focus();
    } finally {
      validatingRef.current = false;
      setValidating(false);
    }
  };

  // Auto-verify as soon as all digits are entered (typing, paste, autofill).
  useEffect(() => {
    if (!isComplete || validating || success || otpExpired) return;
    validateOtp(otpValue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, otpValue, validating, success, otpExpired]);

  const handleResendOtp = async () => {
    if (resending) return;
    const userEmail = userEmailProp || storage.get('userEmail');
    const userId = userIdProp
      || storage.get('userId')
      || storage.get('dbUserId')
      || null;
    const coachId = requestInfo?.coachId;
    if ((!userEmail && !userId) || !coachId) {
      setError('Unable to request a new code. Go back and select your coach again.');
      return;
    }
    setResending(true);
    setError('');
    try {
      const body = { coachId };
      if (userEmail) body.email = userEmail;
      else body.userId = userId;
      await axios.post(`${API_BASE}/api/upline/request`, body);
      setOtpExpired(false);
      setSuccess('A new code was sent to your coach.');
      resetOtp();
      await fetchRequestInfo();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send a new code.');
    } finally {
      setResending(false);
    }
  };

  // Cancel verification
  const handleCancel = async () => {
    try {
      const userEmail = userEmailProp || storage.get('userEmail');
      const userId = userIdProp || storage.get('userId');
      if (!userEmail && !userId) {
        setError('Account not found. Please login again.');
        return;
      }

      setCancelling(true);

      const body = {};
      if (userEmail) body.email = userEmail;
      if (userId) body.userId = userId;

      await axios.post(
        `${API_BASE}/api/upline/cancel-request`,
        body,
      );

      debugLog("\ud83d\udfe6 [ValidateOTP] User clicked Cancel, closing modal");
      if (onClose) onClose();
    } catch (err) {
      console.error('\ud83d\udd34 [ValidateOTP] Cancel error:', err);
      setError('Failed to cancel request');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-green-900/40 backdrop-blur-sm flex items-center justify-center sm:p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full h-full sm:h-auto sm:max-w-md bg-white sm:rounded-[2rem] shadow-2xl overflow-hidden relative flex flex-col"
      >
        {/* Logout Button */}
        <button 
             onClick={onLogout}
             className="absolute right-4 top-4 z-10 text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
             title="Log Out"
        >
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>

        <div className="px-8 pt-6 pb-6 shrink-0">
          <div className="flex items-center gap-3 pr-12 mb-4">
            <div className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center overflow-hidden">
              <img 
                src={wellnessValleyIcon} 
                alt="Wellness Valley" 
                className="w-full h-full object-contain brand-logo"
                draggable="false"
                style={{ 
                  WebkitUserSelect: 'none', 
                  userSelect: 'none',
                  WebkitTouchCallout: 'none',
                  WebkitUserDrag: 'none'
                }}
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 text-left">
              {otpExpired ? 'Code Expired' : 'Verify Request'}
            </h1>
          </div>
          
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 text-left">
            <p className="text-blue-800 text-sm leading-relaxed">
              {otpExpired
                ? 'The previous verification code is no longer valid. Request a new code for your coach.'
                : "We've sent OTP to your sponsor's email ID. Please contact them and get the OTP to proceed further."}
            </p>
          </div>
        </div>

        <div className="px-8 pb-10 flex-1 overflow-y-auto custom-scrollbar">
          <OtpInputCells
            otpCtl={otpCtl}
            length={EMAIL_OTP_LENGTH}
            emailOtp
            disabled={validating || otpExpired}
            className="flex justify-center gap-2 sm:gap-3 mb-6"
            cellClassName={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold bg-gray-50 border-2 rounded-2xl transition-all outline-none focus:bg-white focus:border-green-500 ${
              error ? 'border-red-200 bg-red-50 text-red-600' :
              success ? 'border-green-500 bg-green-50 text-green-600' : ''
            }`}
            cellStyle={(digit) => (
              !error && !success && digit
                ? { borderColor: '#22c55e', backgroundColor: '#ffffff' }
                : undefined
            )}
          />

          <div className="text-center mb-8 min-h-[24px]">
            {error ? (
              <span className="text-red-500 font-medium text-sm flex items-center justify-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </span>
            ) : success ? (
              <span className="text-green-600 font-bold text-sm flex items-center justify-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Verified Successfully!
              </span>
            ) : (
              <span className="text-sm text-gray-400">
                {attemptsLeft} attempts remaining
              </span>
            )}
          </div>

          <button
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
              validating || !isComplete
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200'
            }`}
            onClick={() => validateOtp()}
            disabled={validating || !isComplete || otpExpired}
          >
            {validating ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>Verify Code</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </>
            )}
          </button>

          {(otpExpired || error?.toLowerCase().includes('expired')) && (
            <button
              className="w-full mt-3 py-3.5 rounded-xl font-bold text-base bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              onClick={handleResendOtp}
              disabled={resending || validating}
            >
              {resending ? 'Sending new code...' : 'Request new code'}
            </button>
          )}

          {/* Demo Skip Button — only visible for demo/admin account */}
          {(localStorage.getItem('userEmail') || '').toLowerCase().trim() === DEMO_EMAIL && (
            <button
              className="w-full mt-3 py-3 rounded-xl font-semibold text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              onClick={() => {
                const filled = fillAll('0000');
                if (filled) validateOtp(filled);
              }}
              disabled={validating}
            >
              <span>Skip & Continue (Demo)</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
          )}
          
          {/* Hide "Go Back" button in reactivation flow - user already has a coach */}
          {!isReactivationFlow && (
            <div className="mt-6 text-center">
              <button 
                onClick={handleCancel} 
                disabled={validating || cancelling}
                className="w-full py-3 rounded-xl font-semibold text-sm border-2 border-gray-300 text-gray-600 hover:border-red-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto transition-all"
              >
                {cancelling ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    <span>Go Back To Select Different Sponsor</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ValidateOTP;
