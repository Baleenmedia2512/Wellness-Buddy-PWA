// Short consent step for accounts that were created without the signup checkbox
// (older apps, or a session that never accepted). New signups accept on the
// login screen before OTP, and do not see this page.
import React, { useState } from 'react';
import TermsAndConditions from '../../../shared/components/TermsAndConditions';
import PrivacyPolicy from '../../../shared/components/PrivacyPolicy';
import wellnessValleyIcon from '../../../assets/wellness-valley-icon.png';

const ConsentForm = ({
  onAgree,
  onDecline,
  submitting = false,
  identityLabel = '',
}) => {
  const [accepted, setAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [localError, setLocalError] = useState('');

  const openDoc = (event, open) => {
    event.preventDefault();
    event.stopPropagation();
    open();
  };

  const handleContinue = () => {
    if (!accepted) {
      setLocalError('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }
    setLocalError('');
    onAgree?.();
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-white overflow-y-auto"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)',
      }}
    >
      <div className="max-w-sm mx-auto px-5 pt-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-3 overflow-hidden">
            <img
              src={wellnessValleyIcon}
              alt="Wellness Valley"
              draggable="false"
              className="w-full h-full object-contain brand-logo"
            />
          </div>
          <h1 className="text-xl font-bold text-gray-900">User Consent Form</h1>
          {identityLabel ? (
            <p className="text-sm text-gray-500 mt-2">Signed in as {identityLabel}</p>
          ) : null}
        </div>

        <div className="flex items-start gap-2.5">
          <input
            id="consent-terms"
            type="checkbox"
            checked={accepted}
            onChange={(e) => {
              setAccepted(e.target.checked);
              setLocalError('');
            }}
            disabled={submitting}
            aria-label="Accept Terms of Service and Privacy Policy"
            className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded border-gray-300 accent-[#2563eb]"
          />
          <label htmlFor="consent-terms" className="text-sm leading-snug text-gray-600">
            By Signing up, I accept the{' '}
            <button
              type="button"
              className="inline compact-touch p-0 align-baseline font-medium text-[#2563eb] underline underline-offset-2"
              onClick={(e) => openDoc(e, () => setShowTerms(true))}
            >
              Terms of Service
            </button>
            {' '}and acknowledge the{' '}
            <button
              type="button"
              className="inline compact-touch p-0 align-baseline font-medium text-[#2563eb] underline underline-offset-2"
              onClick={(e) => openDoc(e, () => setShowPrivacy(true))}
            >
              Privacy Policy
            </button>
          </label>
        </div>

        {localError ? (
          <p className="mt-3 text-sm text-red-600" role="alert">{localError}</p>
        ) : null}

        <button
          type="button"
          onClick={handleContinue}
          disabled={submitting || !accepted}
          className="mt-6 w-full py-3.5 rounded-xl text-white font-semibold shadow-sm bg-gradient-to-r from-green-400 to-teal-400 disabled:opacity-50"
        >
          {submitting ? 'Please wait…' : 'Continue'}
        </button>

        <button
          type="button"
          onClick={() => onDecline?.()}
          disabled={submitting}
          className="mt-4 w-full text-sm text-gray-500 underline underline-offset-2 disabled:opacity-50"
        >
          Sign out
        </button>
      </div>

      {showTerms && <TermsAndConditions onClose={() => setShowTerms(false)} />}
      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)} />}
    </div>
  );
};

export default ConsentForm;
