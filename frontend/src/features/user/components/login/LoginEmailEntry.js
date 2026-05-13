// Email entry step — input + Send OTP button + optional Google-unavailable notice.
import React from 'react';

const Spinner = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const LoginEmailEntry = ({ email, setEmail, onSubmit, loading, googleUnavailable }) => (
  <div className="space-y-4">
    {googleUnavailable && (
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start">
          <svg className="h-5 w-5 text-yellow-500 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-xs text-yellow-700">
            <strong>Google sign-in is unavailable</strong> on this domain. Please sign in with your email below.
          </p>
        </div>
      </div>
    )}
    <div>
      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
      <input
        id="email" type="email" value={email}
        onChange={(e) => setEmail(e.target.value)} required
        placeholder="Enter your email"
        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition-all duration-300 text-base"
      />
    </div>
    <button
      type="button" onClick={onSubmit} disabled={loading || !email}
      className="w-full flex items-center justify-center px-4 xs:px-6 py-3 xs:py-3.5 bg-gradient-to-r from-green-400 to-teal-400 text-white rounded-xl shadow-sm hover:shadow-md hover:from-green-500 hover:to-teal-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-400 disabled:opacity-50 min-h-[48px]"
    >
      {loading ? <span className="flex items-center"><Spinner />Sending OTP...</span> : 'Send OTP'}
    </button>
  </div>
);

export default LoginEmailEntry;
