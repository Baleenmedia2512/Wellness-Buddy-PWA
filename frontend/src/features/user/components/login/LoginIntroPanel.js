// Login intro: Google sign-in button + divider + "Continue with Email" entry button.
import React from 'react';
import { Capacitor } from '@capacitor/core';

const GoogleIcon = () => (
  <svg className="h-5 w-5 mr-3 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const LoginIntroPanel = ({ onChooseEmail, onSignIn, loading, error }) => {
  const handleGoogleClick = () => {
    if (!onSignIn) return;
    sessionStorage.setItem('freshGoogleSignIn', 'true');
    onSignIn();
  };

  return (
    <>
      {!Capacitor.isNativePlatform() && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-blue-700">
              <strong>Mobile users:</strong> Please enable popups for this site in your browser settings to use Google sign-in. Or use email sign-in below.
            </p>
          </div>
        </div>
      )}

      {onSignIn && (
        <button
          onClick={handleGoogleClick}
          disabled={loading}
          className="w-full flex items-center justify-center px-4 xs:px-6 py-3 xs:py-3.5 bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:bg-gray-50 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Continue with Google"
        >
          {loading ? (
            <span className="text-sm font-medium text-gray-600">Signing in...</span>
          ) : (
            <div className="flex items-center">
              <GoogleIcon />
              <span className="text-sm font-medium text-gray-700">Continue with Google</span>
            </div>
          )}
        </button>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600 text-center" role="alert">{error}</p>
      )}

      <div className="flex items-center my-4">
        <div className="flex-1 border-t border-gray-200" />
        <span className="mx-3 text-xs text-gray-400">or</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      <button
        onClick={onChooseEmail}
        className="w-full flex items-center justify-center px-4 xs:px-6 py-3 xs:py-3.5 bg-gray-50 border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:bg-gray-100 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-400 min-h-[48px]"
      >
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">Continue with Email</span>
        </div>
      </button>
    </>
  );
};

export default LoginIntroPanel;
