import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import wellnessValleyIcon from '../assets/wellness-valley-icon.png';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const ValidateOTP = ({ onClose, onSuccess, onLogout }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [validating, setValidating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requestInfo, setRequestInfo] = useState(null);
  const [attemptsLeft, setAttemptsLeft] = useState(5);

  const inputRefs = useRef([]);

  // Fetch request info on load
  useEffect(() => {
    fetchRequestInfo();
  }, []);

  const fetchRequestInfo = async () => {
    try {
      const userEmail = localStorage.getItem('userEmail');
      if (!userEmail) {
        setError('User email not found. Please login again.');
        return;
      }

      const response = await axios.get(
        `${API_BASE}/api/user/status?email=${encodeURIComponent(userEmail)}`
      );

      if (response.data.pendingRequest) {
        setRequestInfo(response.data.pendingRequest);
      } else {
        if (onClose) onClose();
      }
    } catch (err) {
      console.error("Error fetching request info:", err);
    }
  };

  // Handle OTP input
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    
    setOtp(newOtp);
    const nextIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  // Validate OTP
  const validateOtp = async () => {
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setValidating(true);
    setError('');

    try {
      const userEmail = localStorage.getItem('userEmail');
      if (!userEmail) {
        setError('User email not found. Please login again.');
        return;
      }

      await axios.post(
        `${API_BASE}/api/upline/validate-otp`,
        { otp: otpCode, email: userEmail }
      );

      setSuccess('Verified!');
      
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        } else if (onClose) {
          onClose();
        }
      }, 1500);
    } catch (err) {
      const errorData = err.response?.data;
      
      if (errorData?.expired) {
        setError('Code expired. Please request a new one.');
      } else if (errorData?.attemptsLeft !== undefined) {
        setAttemptsLeft(errorData.attemptsLeft);
        setError(`Incorrect code. ${errorData.attemptsLeft} attempts left.`);
      } else {
        setError(errorData?.error || 'Verification failed');
      }
      
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setValidating(false);
    }
  };

  // Auto-submit
  useEffect(() => {
    if (otp.every(digit => digit !== '')) {
      validateOtp();
    }
  }, [otp]);

  // Cancel verification
  const handleCancel = async () => {
    try {
      const userEmail = localStorage.getItem('userEmail');
      if (!userEmail) {
        setError('User email not found. Please login again.');
        return;
      }

      setCancelling(true);
      
      await axios.post(
        `${API_BASE}/api/upline/cancel-request`,
        { email: userEmail }
      );

      // Close modal and refresh setup status
      if (onClose) {
        onClose();
      }
    } catch (err) {
      console.error('Cancel error:', err);
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

        <div className="px-8 pt-10 pb-6 text-center shrink-0">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden">
            <img 
              src={wellnessValleyIcon} 
              alt="Wellness Valley" 
              className="w-full h-full object-contain brand-logo"
              draggable="false"
              style={{ WebkitUserSelect: 'none', userSelect: 'none', pointerEvents: 'none' }}
            />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify Request</h1>
          
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 text-left">
            <p className="text-blue-800 text-sm leading-relaxed">
              We've sent a request to <span className="font-bold">{requestInfo?.coachName || 'your coach'}</span>. 
              Please contact them to approve your request and provide your 6-digit verification code.
            </p>
          </div>
        </div>

        <div className="px-8 pb-10 flex-1 overflow-y-auto custom-scrollbar">
          <div className="flex justify-center gap-2 sm:gap-3 mb-8">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={el => inputRefs.current[index] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold bg-gray-50 border-2 rounded-2xl transition-all outline-none focus:bg-white focus:scale-105 ${
                  error ? 'border-red-200 bg-red-50 text-red-600' : 
                  success ? 'border-green-500 bg-green-50 text-green-600' :
                  digit ? 'border-green-500 bg-white' : 'border-transparent focus:border-green-500'
                }`}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                disabled={validating}
                autoFocus={index === 0}
              />
            ))}
          </div>

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
              validating || otp.join('').length !== 6
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200'
            }`}
            onClick={validateOtp}
            disabled={validating || otp.join('').length !== 6}
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
          
          <div className="mt-6 text-center">
            <button 
              onClick={handleCancel} 
              disabled={validating || cancelling}
              className="text-gray-400 text-sm hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 mx-auto transition-colors"
            >
              {cancelling ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                  <span>Cancelling...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  <span>Cancel Verification</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ValidateOTP;
