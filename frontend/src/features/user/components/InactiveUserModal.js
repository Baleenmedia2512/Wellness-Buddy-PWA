import React from 'react';
import { AlertTriangle, X, User } from 'lucide-react';

const InactiveUserModal = ({ userEmail, coachName, onClose, onContactCoach }) => {
  const displayCoachName = coachName?.trim() || 'Your assigned coach';

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all duration-300 ease-out">
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
              To request access, please contact your Coach
            </p>
            <div className="flex items-center justify-center space-x-2 text-gray-700">
              <User className="h-4 w-4 text-gray-500 shrink-0" />
              <span className="font-medium text-sm text-gray-800">{displayCoachName}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col space-y-3 pt-2">
            {onContactCoach ? (
              <button
                onClick={onContactCoach}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3.5 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
              >
                Contact Your Coach
              </button>
            ) : (
              <button
                onClick={handleClose}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-xl transition-all duration-200"
              >
                Return to Login
              </button>
            )}
          </div>

          {/* Info note */}
          <div className="pt-2">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              Contact your coach to verify your account. Once your coach approves your request using OTP, your account will be activated.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InactiveUserModal;
