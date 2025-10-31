import React from 'react';
import { AlertTriangle, X, Mail } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const InactiveUserModal = ({ userEmail, onClose }) => {
  const supportEmail = 'easy2work.india@gmail.com';

  const handleSendEmail = async () => {
    const subject = encodeURIComponent('Wellness Buddy - Account Access Request');
    const body = encodeURIComponent(
      `Hello Wellness Buddy Support,\n\n` +
      `My account (${userEmail}) is currently restricted from accessing the app.\n\n` +
      `I would like to request access to continue using Wellness Buddy.\n\n` +
      `Please review my account status and help me regain access.\n\n` +
      `Thank you for your assistance.\n\n` +
      `Best regards`
    );
    
    const mailtoUrl = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
    
    // Use Capacitor's App plugin for better Android compatibility
    if (Capacitor.isNativePlatform()) {
      try {
        await App.openUrl({ url: mailtoUrl });
      } catch (error) {
        console.error('Error opening email app:', error);
        // Fallback to window.location
        window.location.href = mailtoUrl;
      }
    } else {
      window.location.href = mailtoUrl;
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all animate-slideUp">
        {/* Header with close button */}
        <div className="relative bg-gradient-to-r from-red-500 to-red-600 rounded-t-2xl p-6">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          
          {/* Warning Icon */}
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-full">
              <AlertTriangle className="h-12 w-12 text-white" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-white text-center">
            Account Restricted
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-gray-800 text-center leading-relaxed">
              Your account <span className="font-semibold text-red-600">{userEmail}</span> is currently inactive and cannot access the app.
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-sm text-gray-600 text-center">
              To request access, please contact our support team:
            </p>
            <div className="flex items-center justify-center space-x-2 text-gray-700">
              <Mail className="h-4 w-4 text-gray-500" />
              <a 
                href={`mailto:${supportEmail}`}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                {supportEmail}
              </a>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col space-y-3 pt-2">
            <button
              onClick={handleSendEmail}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3.5 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <Mail className="h-5 w-5" />
              <span>Request Access via Email</span>
            </button>
            
            <button
              onClick={handleClose}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-xl transition-all duration-200"
            >
              Return to Login
            </button>
          </div>

          {/* Info note */}
          <div className="pt-2">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              Our team typically responds within 24-48 hours. You'll receive an email once your account is reviewed.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default InactiveUserModal;
