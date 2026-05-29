// Login intro: "Continue with Email" entry button.
import React from 'react';

const LoginIntroPanel = ({ onChooseEmail }) => {
  return (
    <>
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
