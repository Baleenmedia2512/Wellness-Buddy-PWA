import React from 'react';

const StatusOverlay = ({ status, onRetry }) => (
  <div className="absolute inset-0 bg-white rounded-3xl flex items-center justify-center z-10 animate-fadeIn">
    <div className="text-center p-8">
      {status === 'success' ? (
        <>
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Changes Saved!</h3>
          <p className="text-sm text-green-600 font-medium">Your meal has been updated successfully</p>
        </>
      ) : (
        <>
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Update Failed</h3>
          <p className="text-sm text-gray-500 mb-4">Unable to save changes. Please try again.</p>
          <button onClick={onRetry} className="bg-red-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-red-600">Try Again</button>
        </>
      )}
    </div>
  </div>
);

export default StatusOverlay;
