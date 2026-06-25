// src/features/user/components/Login.js
// Orchestrator — wires useAuthFlow + useOtpInput + useResendCountdown.
// Entry step goes directly to the unified Mobile / Email input (no intro panel).
// OTP screen auto-verifies via WebOTP (Android) / iOS autofill / paste — no
// manual Verify button required.
import React, { useEffect, useState } from 'react';
import TermsAndConditions from '../../../shared/components/TermsAndConditions';
import PrivacyPolicy from '../../../shared/components/PrivacyPolicy';
import wellnessValleyIcon from '../../../assets/wellness-valley-icon.png';
import useAuthFlow from '../hooks/useAuthFlow';
import useOtpInput from '../hooks/useOtpInput';
import useResendCountdown from '../hooks/useResendCountdown';
import LoginBlobs from './login/LoginBlobs';
import LoginEmailEntry from './login/LoginEmailEntry';
import LoginOtpEntry from './login/LoginOtpEntry';

const Login = ({ onSignIn, loading, error, onOtpVerified, forceOtpVerification }) => {
  const auth = useAuthFlow({ onOtpVerified });
  const otpCtl = useOtpInput(6);
  const resend = useResendCountdown(60, auth.otpSent);
  // Always start on the email/phone entry — no intro panel step.
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    if (forceOtpVerification) { auth.setOtpSent(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, [forceOtpVerification]);

  const handleSendOtp = async () => {
    const ok = await auth.sendOtp();
    if (ok) resend.start(60);
  };
  const handleResendOtp = async () => {
    auth.setErrorMessage('');
    otpCtl.reset();
    const ok = await auth.sendOtp();
    if (ok) resend.start(60);
  };
  const handleBackToEmail = () => {
    auth.resetOtpScreen();
    otpCtl.reset();
    resend.start(60);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6 xs:py-8 relative overflow-hidden"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 24px)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}>
      <LoginBlobs />
      <div className="w-full max-w-sm xs:max-w-md bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden relative z-10 border border-white/20">
        <div className="h-1.5 xs:h-2 bg-gradient-to-r from-green-400 to-teal-400" />
        <div className="p-5 xs:p-6 sm:p-8">
          <div className="text-center mb-6 xs:mb-8">
            <div className="w-20 h-20 xs:w-24 xs:h-24 rounded-2xl flex items-center justify-center mx-auto mb-3 xs:mb-4 overflow-hidden">
              <img src={wellnessValleyIcon} alt="Wellness Valley" draggable="false"
                className="w-full h-full object-contain brand-logo"
                style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none', WebkitUserDrag: 'none' }} />
            </div>
            <h1 className="text-2xl xs:text-3xl font-bold text-gray-800 mb-1.5 xs:mb-2">
              {auth.otpSent ? 'Enter OTP' : 'Wellness Valley'}
            </h1>
            <p className="text-sm xs:text-base text-gray-500">
              {auth.otpSent
                ? `We've sent a verification code to ${auth.activeChannel === 'phone' ? 'your phone' : auth.email}`
                : 'Enter your mobile number or email to continue'}
            </p>
          </div>
          {!auth.otpSent ? (
            <LoginEmailEntry email={auth.email} setEmail={auth.setEmail}
              countryDial={auth.countryDial} setCountryDial={auth.setCountryDial}
              onSubmit={handleSendOtp} loading={auth.loading} />
          ) : (
            <LoginOtpEntry otpCtl={otpCtl} onVerify={auth.verifyOtp}
              loading={auth.loading} verified={auth.verified}
              errorMessage={auth.errorMessage} successMessage={auth.successMessage}
              countdown={resend.countdown} canResend={resend.canResend}
              onResend={handleResendOtp} onBack={handleBackToEmail} />
          )}
          <p className="mt-6 text-center text-xs text-gray-400">
            By continuing, you agree to our{' '}
            <button onClick={() => setShowTerms(true)} className="text-green-500 hover:text-green-600 underline">Terms</button>{' '}
            and{' '}
            <button onClick={() => setShowPrivacy(true)} className="text-green-500 hover:text-green-600 underline">Privacy Policy</button>
          </p>
        </div>
      </div>
      {showTerms && <TermsAndConditions onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)} />}
    </div>
  );
};

export default Login;
