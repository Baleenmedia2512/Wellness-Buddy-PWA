import React, { useState } from 'react';
import { X } from 'lucide-react';

const UserNotFoundModal = ({ onClose }) => {
  const [emailSent, setEmailSent] = useState(false);
  const supportEmail = 'easy2work.india@gmail.com';

  console.log('🟠 [UserNotFoundModal] Modal component rendered');

  const handleSendEmail = () => {
    console.log('📧 [UserNotFoundModal] Send Email button clicked');
    const subject = encodeURIComponent('User Not Found - Wellness Buddy');
    const body = encodeURIComponent(
      'Hello,\n\n' +
      'I am trying to access the Wellness Buddy app, but my account was not found in the system.\n\n' +
      'Please help me resolve this issue and create/restore my account.\n\n' +
      'Thank you.'
    );
    
    console.log('📧 [UserNotFoundModal] Opening email client to:', supportEmail);
    window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
    setEmailSent(true);
    
    setTimeout(() => setEmailSent(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={() => {
            console.log('❌ [UserNotFoundModal] Close button clicked');
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Content */}
        <div className="p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
              <svg 
                className="w-8 h-8 text-orange-600" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
            User Not Found
          </h2>

          {/* Message */}
          <p className="text-gray-600 text-center mb-6 leading-relaxed">
            Your account was not found in our system. Please contact our support team to resolve this issue.
          </p>

          {/* Support email display */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">Contact Support</p>
            <p className="text-gray-900 font-medium break-all">{supportEmail}</p>
          </div>

          {/* Send Email Button */}
          <button
            onClick={handleSendEmail}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 shadow-md hover:shadow-lg"
          >
            Send Email
          </button>

          {/* Email sent confirmation */}
          {emailSent && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700 text-center">
                Email client opened successfully
              </p>
            </div>
          )}

          {/* Additional info */}
          <p className="mt-6 text-xs text-gray-400 text-center">
            Our support team will help you get access to the app.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserNotFoundModal;
