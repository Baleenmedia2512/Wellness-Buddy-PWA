// src/components/DeleteAccountModal.js
import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X, CheckCircle, Loader, Mail, ShieldCheck } from 'lucide-react';
import TouchFeedbackButton from './TouchFeedbackButton';
import { deleteFirebaseUser } from '../services/firebase';

/**
 * DeleteAccountModal — Apple Guideline 5.1.1(v) compliant
 *
 * 4-step self-service account deletion:
 *   Step 1 — Warning screen with data list
 *   Step 2 — OTP sent to registered email, user enters it
 *   Step 3 — User must type "DELETE" to confirm
 *   Step 4 — Success / error feedback → auto sign-out
 */

// ✅ Key used to persist OTP pending state across app close/reopen
const DELETE_OTP_PENDING_KEY = 'deleteAccountOtpPending';

const DeleteAccountModal = ({ isOpen, onClose, userEmail, onAccountDeleted, onSignOut }) => {
  const [step, setStep] = useState(1);

  // Step 2 — OTP
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const otpRefs = useRef([]);

  // Step 3 — type DELETE
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const CONFIRM_WORD = 'DELETE';
  const isConfirmValid = confirmText.trim().toUpperCase() === CONFIRM_WORD;
  const otpValue = otp.join('');
  const isOtpComplete = otpValue.length === 6;

  // ✅ Restore pending OTP step when modal opens (survives app close/reopen)
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(DELETE_OTP_PENDING_KEY);
      if (saved) {
        const { email, sentAt } = JSON.parse(saved);
        const age = Date.now() - sentAt;
        // Only restore if same user and OTP sent within 10 minutes
        if (email === userEmail && age < 10 * 60 * 1000) {
          const elapsed = Math.floor(age / 1000);
          const remaining = Math.max(0, 60 - elapsed);
          setStep(2);
          setOtpSent(true);
          setCountdown(remaining);
          setCanResend(remaining === 0);
          console.log('🔄 [DeleteAccount] Restored pending OTP step, countdown:', remaining);
          setTimeout(() => otpRefs.current[0]?.focus(), 300);
        } else {
          // Expired or different user — clear it
          localStorage.removeItem(DELETE_OTP_PENDING_KEY);
        }
      }
    } catch {
      localStorage.removeItem(DELETE_OTP_PENDING_KEY);
    }
  }, [isOpen, userEmail]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (!otpSent || countdown <= 0) {
      if (countdown === 0) setCanResend(true);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpSent, countdown]);

  const resetState = () => {
    setStep(1);
    setOtp(['', '', '', '', '', '']);
    setOtpSent(false);
    setOtpSending(false);
    setOtpVerifying(false);
    setCountdown(60);
    setCanResend(false);
    setConfirmText('');
    setIsDeleting(false);
    setErrorMessage('');
    // ✅ Clear persisted state when user cancels
    localStorage.removeItem(DELETE_OTP_PENDING_KEY);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // ── Step 1 → 2: Send OTP ─────────────────────────────────────────────────
  const handleSendOtp = async () => {
    setOtpSending(true);
    setErrorMessage('');
    try {
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
      const res = await fetch(`${apiBaseUrl}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: userEmail, contactType: 'email' }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setStep(2);
        setCountdown(60);
        setCanResend(false);
        // ✅ Persist OTP pending state so it survives app close/reopen
        localStorage.setItem(DELETE_OTP_PENDING_KEY, JSON.stringify({ email: userEmail, sentAt: Date.now() }));
        setTimeout(() => otpRefs.current[0]?.focus(), 300);
      } else {
        setErrorMessage(data.message || 'Failed to send OTP. Try again.');
      }
    } catch {
      setErrorMessage('Network error. Please check your connection.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleResendOtp = async () => {
    setCanResend(false);
    setCountdown(60);
    setOtp(['', '', '', '', '', '']);
    setErrorMessage('');
    setOtpSending(true);
    try {
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
      const res = await fetch(`${apiBaseUrl}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: userEmail, contactType: 'email' }),
      });
      const data = await res.json();
      if (!data.success) setErrorMessage(data.message || 'Failed to resend OTP.');
      else setTimeout(() => otpRefs.current[0]?.focus(), 200);
    } catch {
      setErrorMessage('Network error. Please check your connection.');
    } finally {
      setOtpSending(false);
    }
  };

  // ── OTP input handling ────────────────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setErrorMessage('');
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  // ── Step 2 → 3: Verify OTP ───────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (!isOtpComplete) return;
    setOtpVerifying(true);
    setErrorMessage('');
    try {
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
      const res = await fetch(`${apiBaseUrl}/api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: userEmail, otp: otpValue, contactType: 'email', purpose: 'delete' }),
      });
      const data = await res.json();
      if (data.success) {
        setStep(3);
        setErrorMessage('');
        // ✅ OTP verified — no longer need to restore to step 2
        localStorage.removeItem(DELETE_OTP_PENDING_KEY);
      } else {
        setErrorMessage(data.message || 'Invalid OTP. Please try again.');
      }
    } catch {
      setErrorMessage('Network error. Please check your connection.');
    } finally {
      setOtpVerifying(false);
    }
  };

  // ── Step 3 → 4: Delete Account ───────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (!isConfirmValid) return;
    setIsDeleting(true);
    setErrorMessage('');
    try {
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
      const res = await fetch(`${apiBaseUrl}/api/delete-user-account`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await res.json();
      if (data.success) {
        // Clear all client-side caches and stored user data
        try {
          // Clear all localStorage keys related to this account
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) keysToRemove.push(key);
          }
          keysToRemove.forEach((key) => localStorage.removeItem(key));

          // ✅ CRITICAL: Re-set the sign-out block flag IMMEDIATELY after clearing localStorage.
          // Without this, Firebase's onAuthStateChanged can silently re-authenticate
          // the user in the gap between localStorage clear and signOutUser() being called.
          localStorage.setItem('userSignedOut', 'true');
          localStorage.setItem('accountDeleted', 'true');

          // Clear sessionStorage as well
          sessionStorage.clear();

          // Clear any service worker caches
          if ('caches' in window) {
            caches.keys().then((cacheNames) => {
              cacheNames.forEach((cacheName) => caches.delete(cacheName));
            });
          }
        } catch (clearErr) {
          console.warn('[DeleteAccountModal] Cache clear error (non-critical):', clearErr);
        }

        // ✅ Delete the Firebase Auth user so the token is permanently invalidated.
        // This prevents the app from silently re-logging in on next open.
        try {
          await deleteFirebaseUser();
        } catch (fbErr) {
          console.warn('[DeleteAccountModal] Firebase user delete error (non-fatal):', fbErr);
        }

        // ✅ Sign out IMMEDIATELY so background app state clears before step 4 shows
        try {
          if (onSignOut) onSignOut();
        } catch (signOutErr) {
          console.warn('[DeleteAccountModal] Sign-out error (non-critical):', signOutErr);
        }

        setStep(4);
      } else {
        setErrorMessage(data.message || 'Failed to delete account. Please try again.');
      }
    } catch {
      setErrorMessage('Network error. Please check your connection and try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm transition-colors ${step === 4 ? 'bg-black/90' : 'bg-black/60'}`}>
      {/* Bottom sheet on mobile, centered card on sm+ screens */}
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]">

        {/* ══ STEP 1 — Warning ══════════════════════════════════════════════ */}
        {step === 1 && (
          <>
            {/* Drag handle — visible on mobile only */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            <div className="bg-red-50 px-5 pt-4 pb-4 border-b border-red-100">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-red-700">Delete Account</h2>
                  <p className="text-xs text-red-600 mt-0.5">This action is permanent and cannot be undone.</p>
                </div>
                <TouchFeedbackButton onClick={handleClose} className="ml-auto p-1.5 rounded-full hover:bg-red-100 transition-colors flex-shrink-0" ariaLabel="Close">
                  <X className="h-4 w-4 text-red-400" />
                </TouchFeedbackButton>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-5 py-4">
              <p className="text-sm text-gray-700 font-medium mb-3">Deleting your account will permanently remove:</p>
              <ul className="space-y-1.5 mb-4">
                {[
                  'Your profile and personal information',
                  'All nutrition analysis and food history',
                  'Weight records and progress data',
                  'Education and wellness activity logs',
                  'All other app data associated with your account',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className="mt-0.5 h-4 w-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">✕</span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
                <p className="text-xs text-amber-700"><strong>⚠️ Note:</strong> Once deleted, your account and all data cannot be recovered.</p>
              </div>
              {errorMessage && (
                <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-600">{errorMessage}</p>
                </div>
              )}
            </div>

            {/* Sticky footer buttons */}
            <div className="flex gap-3 px-5 pt-3 pb-5 sm:pb-5 border-t border-gray-100 bg-white" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
              <TouchFeedbackButton onClick={handleClose} className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors" ariaLabel="Cancel">
                Cancel
              </TouchFeedbackButton>
              <TouchFeedbackButton
                onClick={handleSendOtp}
                disabled={otpSending}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                ariaLabel="Continue"
              >
                {otpSending ? <><Loader className="h-4 w-4 animate-spin" /> Sending...</> : <><Mail className="h-4 w-4" /> Continue</>}
              </TouchFeedbackButton>
            </div>
          </>
        )}

        {/* ══ STEP 2 — OTP Verification ════════════════════════════════════ */}
        {step === 2 && (
          <>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            <div className="bg-red-50 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-red-600" />
                  <h2 className="text-base font-bold text-red-600">Verify Your Identity</h2>
                </div>
                <TouchFeedbackButton onClick={handleClose} className="p-1.5 rounded-full hover:bg-red-100 transition-colors" ariaLabel="Close">
                  <X className="h-4 w-4 text-red-600" />
                </TouchFeedbackButton>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-5">
              <div className="flex justify-center mb-3">
                <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
                  <Mail className="h-7 w-7 text-red-500" />
                </div>
              </div>
              <p className="text-sm text-gray-700 text-center mb-1">We sent a 6-digit OTP to:</p>
              <p className="text-sm font-semibold text-gray-900 text-center mb-5 truncate px-2">{userEmail}</p>

              {/* 6-box OTP input */}
              <div className="flex justify-center gap-2 mb-3" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-11 h-12 text-center text-lg font-bold border-2 rounded-xl focus:outline-none focus:border-red-500 transition-colors text-[16px]"
                    style={{ borderColor: digit ? '#dc2626' : '#e5e7eb' }}
                  />
                ))}
              </div>

              {/* Resend */}
              <div className="text-center mb-3">
                {canResend ? (
                  <TouchFeedbackButton onClick={handleResendOtp} disabled={otpSending} className="text-xs text-red-600 font-semibold underline disabled:opacity-50" ariaLabel="Resend OTP">
                    {otpSending ? 'Sending...' : 'Resend OTP'}
                  </TouchFeedbackButton>
                ) : (
                  <p className="text-xs text-gray-400">Resend OTP in <span className="font-semibold text-gray-600">{countdown}s</span></p>
                )}
              </div>

              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-600">{errorMessage}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-5 pt-3 pb-5 border-t border-gray-100 bg-white" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
              <TouchFeedbackButton onClick={() => { setStep(1); setOtp(['','','','','','']); setErrorMessage(''); }} className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors" ariaLabel="Back">
                Back
              </TouchFeedbackButton>
              <TouchFeedbackButton
                onClick={handleVerifyOtp}
                disabled={!isOtpComplete || otpVerifying}
                className={`flex-1 py-3 px-4 rounded-xl text-white text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${isOtpComplete && !otpVerifying ? 'bg-red-600 hover:bg-red-700 shadow-lg' : 'bg-gray-300 cursor-not-allowed'}`}
                ariaLabel="Verify OTP"
              >
                {otpVerifying ? <><Loader className="h-4 w-4 animate-spin" /> Verifying...</> : <><ShieldCheck className="h-4 w-4" /> Verify OTP</>}
              </TouchFeedbackButton>
            </div>
          </>
        )}

        {/* ══ STEP 3 — Type DELETE ══════════════════════════════════════════ */}
        {step === 3 && (
          <>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            <div className="bg-red-50 px-5 py-4 border-b border-red-100">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-red-700">Final Confirmation</h2>
                <TouchFeedbackButton onClick={handleClose} className="p-1.5 rounded-full hover:bg-red-100 transition-colors" ariaLabel="Close">
                  <X className="h-4 w-4 text-red-400" />
                </TouchFeedbackButton>
              </div>
              <p className="text-xs text-red-500 mt-1 truncate">{userEmail}</p>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-5">
              <p className="text-sm text-gray-700 mb-4">
                To permanently delete your account, type{' '}
                <span className="font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">DELETE</span>{' '}
                in the box below:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => { setConfirmText(e.target.value); setErrorMessage(''); }}
                placeholder="Type DELETE here"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3.5 text-[16px] font-mono text-center tracking-widest focus:outline-none focus:border-red-400 transition-colors"
                autoFocus
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck="false"
              />
              {errorMessage && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-600">{errorMessage}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-5 pt-3 pb-5 border-t border-gray-100 bg-white" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
              <TouchFeedbackButton onClick={() => { setStep(2); setConfirmText(''); setErrorMessage(''); }} className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors" ariaLabel="Back">
                Back
              </TouchFeedbackButton>
              <TouchFeedbackButton
                onClick={handleDeleteAccount}
                disabled={!isConfirmValid || isDeleting}
                className={`flex-1 py-3 px-4 rounded-xl text-white text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${isConfirmValid && !isDeleting ? 'bg-red-600 hover:bg-red-700 shadow-lg' : 'bg-gray-300 cursor-not-allowed'}`}
                ariaLabel="Permanently delete account"
              >
                {isDeleting ? <><Loader className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete Account</>}
              </TouchFeedbackButton>
            </div>
          </>
        )}

        {/* ══ STEP 4 — Success ══════════════════════════════════════════════ */}
        {step === 4 && (
          <div className="px-5 pt-8 pb-6 text-center" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Account Deleted</h2>
            <p className="text-sm text-gray-600 mb-1">Your account has been permanently deleted.</p>
            <p className="text-xs text-gray-400 mb-6">All your personal data has been removed from our servers.</p>
            <TouchFeedbackButton
              onClick={() => { resetState(); if (onAccountDeleted) onAccountDeleted(); }}
              className="w-full py-3.5 px-4 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
              ariaLabel="Done"
            >
              Done
            </TouchFeedbackButton>
          </div>
        )}

      </div>
    </div>
  );
};

export default DeleteAccountModal;

