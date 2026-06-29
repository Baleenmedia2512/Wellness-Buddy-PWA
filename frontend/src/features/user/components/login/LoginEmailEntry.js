// Login entry step — single input accepts either an email OR a phone number.
// Phone path is fully enabled: when a phone number is detected a country-code
// picker appears and the input switches to `type="tel"`.
import React from 'react';
import { detectContactType, COUNTRY_CODES } from '../../domain/contactIdentifier';

const Spinner = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const LoginEmailEntry = ({
  email, setEmail, onSubmit, loading, googleUnavailable,
  countryDial, setCountryDial, errorMessage,
}) => {
  const channel = detectContactType(email);
  const isPhone = channel === 'phone';

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {googleUnavailable && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-yellow-500 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-xs text-yellow-700">
              <strong>Google sign-in is unavailable</strong> on this domain. Please sign in with your email or phone below.
            </p>
          </div>
        </div>
      )}
      <div>
        <label htmlFor="recipient" className="block text-sm font-medium text-gray-700 mb-2">
          Mobile Number or Email
        </label>
        {isPhone ? (
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
              id="recipient"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              name="tel"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your phone"
              className="flex-1 px-4 py-3 focus:outline-none text-base min-w-0"
            />
          </div>
        ) : (
          <input
            id="recipient"
            type={channel === 'email' ? 'email' : 'tel'}
            inputMode={channel === 'email' ? 'email' : 'numeric'}
            autoComplete={channel === 'email' ? 'email username' : 'tel'}
            name={channel === 'email' ? 'email' : 'tel'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            placeholder="Enter mobile number or email"
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all duration-300 text-base"
          />
        )}
        {isPhone && (
          <p className="mt-1.5 text-xs text-gray-500">
            We&apos;ll send a 6-digit code via SMS to verify your number.
          </p>
        )}
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
