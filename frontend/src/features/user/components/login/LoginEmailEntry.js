// Login entry step — phone number only input.
// Phone OTP flow:
//   - autocomplete="tel" lets Android/iOS fill the number from saved contacts.
//   - Country code picker defaults to India (+91).
//   - After OTP is sent, WebOTP (useWebOtp hook) auto-reads the code from SMS
//     on Android Chrome / Capacitor WebView — no user interaction needed.
//   - When ff.contact-picker is ON and the Contact Picker API is available
//     (Android Chrome 80+), a "Use saved number" button pre-fills the field.
import React, { useEffect, useRef } from 'react';
import { COUNTRY_CODES } from '../../domain/contactIdentifier';
import { useContactPicker } from '../../hooks/useContactPicker';
import { isFlagEnabled } from '../../../../config/featureFlags';

const Spinner = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const LoginEmailEntry = ({
  email, setEmail, onSubmit, loading,
  countryDial, setCountryDial, errorMessage,
}) => {
  const inputRef = useRef(null);
  const { supported: contactPickerSupported, picking, pick } = useContactPicker();
  // Resolve the flag once on mount — toggling at runtime requires a re-mount.
  const contactPickerEnabled = isFlagEnabled('ff.contact-picker');

  // Auto-focus phone input on mount so Android keyboard + number suggestions
  // appear immediately (mirrors Swiggy/Zomato UX).
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="recipient" className="block text-sm font-medium text-gray-700">
            Mobile Number
          </label>
          {/* Contact Picker shortcut — only on Android Chrome when flag is ON */}
          {contactPickerEnabled && contactPickerSupported && (
            <button
              type="button"
              onClick={() => pick(setEmail)}
              disabled={loading || picking}
              aria-label="Fill from contacts"
              className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1 disabled:opacity-50"
            >
              {picking ? (
                <span className="inline-block w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              ) : (
                <span aria-hidden="true">📱</span>
              )}
              Use saved number
            </button>
          )}
        </div>
        <div className="flex w-full rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-green-400 focus-within:border-transparent transition-all duration-300 overflow-hidden">
          <select
            aria-label="Country code"
            value={countryDial}
            onChange={(e) => setCountryDial && setCountryDial(e.target.value)}
            className="bg-gray-50 border-r border-gray-200 px-2 py-3 text-sm text-gray-700 focus:outline-none cursor-pointer"
            style={{ minWidth: '90px' }}
          >
            {COUNTRY_CODES.map((c) => (
              <option key={`${c.code}-${c.dial}`} value={c.dial}>
                {c.flag} {c.dial}
              </option>
            ))}
          </select>
          <input
            ref={inputRef}
            id="recipient"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            name="tel"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            placeholder="Enter mobile number"
            className="flex-1 px-4 py-3 focus:outline-none text-base min-w-0"
          />
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          We&apos;ll send a 6-digit code via SMS to verify your number.
        </p>
      </div>
      {errorMessage && (
        <p className="text-sm text-red-600 text-center">{errorMessage}</p>
      )}
      <button
        type="submit"
        disabled={loading || !email}
        className="w-full flex items-center justify-center px-4 xs:px-6 py-3 xs:py-3.5 bg-gradient-to-r from-green-400 to-teal-400 text-white rounded-xl shadow-sm hover:shadow-md hover:from-green-500 hover:to-teal-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-400 disabled:opacity-50 min-h-[48px]"
      >
        {loading ? <span className="flex items-center"><Spinner />Sending OTP...</span> : 'Send OTP'}
      </button>
    </form>
  );
};

export default LoginEmailEntry;
