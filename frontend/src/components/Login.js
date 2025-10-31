// src/components/Login.js
import React, { useState, useRef, useEffect } from 'react';
import TermsAndConditions from './TermsAndConditions';
import PrivacyPolicy from './PrivacyPolicy';

const Login = ({ onSignIn, loading, onOtpVerified, forceOtpVerification }) => {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(new Array(6).fill(''));
  const [emailLoading, setEmailLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);
  const [otpVerified, setOtpVerified] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    if (otpSent && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCanResend(true);
    }
  }, [countdown, otpSent]);

  useEffect(() => {
    if (forceOtpVerification) {
      setShowEmailForm(true);
      setOtpSent(true);
    }
  }, [forceOtpVerification]);

  const handleSendOTP = async () => {
    setSuccessMessage('');
    setErrorMessage('');
    setEmailLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: email, contactType: 'email' }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setCountdown(60);
        setCanResend(false);
      } else {
        setErrorMessage(data.message);
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      setErrorMessage('Failed to send OTP. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyOTP = async (otpValue = otp.join('')) => {
    setEmailLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setOtpVerified(false); // Reset verified state at start
    try {
      const res = await fetch(`${apiBaseUrl}/api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: email, otp: otpValue, contactType: 'email' }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpVerified(true);
        setSuccessMessage('OTP verified successfully!');

        // ✅ Save user info to localStorage (or state via prop)
        localStorage.setItem('otpUser', JSON.stringify(data.user));

        setTimeout(async () => {
          setSuccessMessage('');
          await onOtpVerified();
          
          // Reset verified state after callback in case user is inactive
          // This allows them to try again if needed
          setTimeout(() => {
            setOtpVerified(false);
          }, 2000);
        }, 1500);
      } else {
        setErrorMessage(data.message);
        setOtpVerified(false);
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      setErrorMessage('Failed to verify OTP. Please try again.');
      setOtpVerified(false);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleOTPChange = (element, index) => {
    const value = element.value;
    if (isNaN(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input
    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }

    // Auto-submit if all digits filled
    if (newOtp.every(digit => digit !== '')) {
      handleVerifyOTP(newOtp.join(''));
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6).split('');
    if (pastedData.every(char => !isNaN(char))) {
      const newOtp = new Array(6).fill('');
      pastedData.forEach((digit, idx) => {
        if (idx < 6) newOtp[idx] = digit;
      });
      setOtp(newOtp);
      if (newOtp.every(digit => digit !== '')) {
        handleVerifyOTP(newOtp.join(''));
      }
    }
  };

  const handleResendOTP = async () => {
    setEmailLoading(true);
    setErrorMessage('');
    try {
      await handleSendOTP();
      setOtp(new Array(6).fill(''));
      setCountdown(60);
      setCanResend(false);
    } catch (error) {
      console.error('Resend OTP error:', error);
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Splashing background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-green-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-teal-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 right-0 w-60 h-60 bg-emerald-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>
      
      {/* Login card */}
      <div className="w-full max-w-md bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden relative z-10 border border-white/20">
        {/* Decorative accent */}
        <div className="h-2 bg-gradient-to-r from-green-400 to-teal-400"></div>
        
        <div className="p-8">
          <div className="text-center mb-8">
            {/* Animated logo */}
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-teal-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {otpSent ? 'Enter OTP' : 'Wellness Buddy'}
            </h1>
            <p className="text-gray-500">
              {otpSent 
                ? `We've sent a verification code to ${email}` 
                : 'Sign in to continue your wellness journey'
              }
            </p>
          </div>
          
          {/* Main content - changes based on state */}
          {!showEmailForm ? (
            <>
              {/* Enhanced Google button - Primary */}
              <button
                onClick={onSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center px-6 py-3.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-400 disabled:opacity-50 mb-4"
              >
                <div className="flex items-center">
                  <img 
                    src="https://developers.google.com/identity/images/g-logo.png"
                    alt="Google logo" 
                    className="h-5 w-5 mr-3"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {loading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Signing in...
                      </span>
                    ) : 'Continue with Google'}
                  </span>
                </div>
              </button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>

              {/* Email form toggle */}
              <button
                onClick={() => setShowEmailForm(true)}
                className="w-full flex items-center justify-center px-6 py-3.5 bg-gray-50 border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:bg-gray-100 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-400"
              >
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Continue with Email</span>
                </div>
              </button>
            </>
          ) : !otpSent ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all duration-300"
                  placeholder="Enter your email"
                />
              </div>

              <button
                type="button"
                onClick={handleSendOTP}
                disabled={emailLoading || !email}
                className="w-full flex items-center justify-center px-6 py-3.5 bg-gradient-to-r from-green-400 to-teal-400 text-white rounded-xl shadow-sm hover:shadow-md hover:from-green-500 hover:to-teal-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-400 disabled:opacity-50"
              >
                {emailLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending OTP...
                  </span>
                ) : (
                  'Send OTP'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowEmailForm(false);
                  setEmail('');
                }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200"
              >
               ← Back to other options
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* OTP Input Fields */}
              <div className="flex justify-center space-x-3">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => inputRefs.current[index] = el}
                    type="text"
                    maxLength="1"
                    value={digit}
                    onChange={(e) => handleOTPChange(e.target, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onPaste={handlePaste}
                    className="w-12 h-12 text-center text-2xl font-bold border-2 border-gray-200 rounded-lg focus:border-green-400 focus:outline-none transition-all duration-300 hover:border-green-300"
                    autoComplete="off"
                  />
                ))}
              </div>

              {/* Verify Button */}
              <button
                onClick={() => handleVerifyOTP()}
                disabled={emailLoading || otp.some(digit => digit === '') || otpVerified}
                className={`w-full flex items-center justify-center px-6 py-3.5 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  otpVerified
                    ? 'bg-green-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-400 to-teal-400 text-white hover:shadow-md hover:from-green-500 hover:to-teal-500'
                }`}
              >
                {otpVerified ? (
                  <span className="flex items-center space-x-2">
                    <svg
                      className="w-5 h-5 text-green-800"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-green-800 font-medium">Verified</span>
                  </span>
                ) : emailLoading ? (
                  'Verifying...'
                ) : (
                  'Verify OTP'
                )}
              </button>

              {/* Minimal Message Below Button */}
              {errorMessage && (
                <p className="mt-2 text-sm text-red-600 text-center">{errorMessage}</p>
              )}
              {successMessage && (
                <p className="mt-2 text-sm text-green-600 text-center">{successMessage}</p>
              )}

              {/* Resend Section */}
              <div className="text-center">
                {!canResend ? (
                  <p className="text-sm text-gray-500">
                    Resend OTP in <span className="font-medium text-green-500">{countdown}s</span>
                  </p>
                ) : (
                  <button
                    onClick={handleResendOTP}
                    disabled={emailLoading}
                    className="text-sm text-green-500 hover:text-green-700 font-medium transition-colors duration-200"
                  >
                    Resend OTP
                  </button>
                )}
              </div>

              {/* Back Button */}
              <button
                onClick={() => {
                  setOtpSent(false);
                  setOtp(new Array(6).fill(''));
                  setCountdown(60);
                  setCanResend(false);
                }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200"
              >
                ← Back to email entry
              </button>
            </div>
          )}
          
          {/* Footer text */}
          <p className="mt-6 text-center text-xs text-gray-400">
            By continuing, you agree to our{' '}
            <button
              onClick={() => setShowTerms(true)}
              className="text-green-500 hover:text-green-600 underline transition-colors duration-200"
            >
              Terms
            </button>{' '}
            and{' '}
            <button
              onClick={() => setShowPrivacy(true)}
              className="text-green-500 hover:text-green-600 underline transition-colors duration-200"
            >
              Privacy Policy
            </button>
          </p>
        </div>
      </div>

      {/* Terms and Conditions Modal */}
      {showTerms && (
        <TermsAndConditions onClose={() => setShowTerms(false)} />
      )}

      {/* Privacy Policy Modal */}
      {showPrivacy && (
        <PrivacyPolicy onClose={() => setShowPrivacy(false)} />
      )}
      
      {/* Add animation styles */}
      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default Login;