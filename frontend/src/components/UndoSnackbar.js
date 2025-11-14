// src/components/UndoSnackbar.js
import React, { useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';

/**
 * UndoSnackbar Component
 * Shows undo notification with countdown timer
 * Reusable for both nutrition and weight entries
 */
const UndoSnackbar = ({ 
  message = 'Entry deleted', 
  onUndo, 
  onDismiss,
  duration = 10000, // 10 seconds default
  visible = false 
}) => {
  const [timeLeft, setTimeLeft] = useState(duration / 1000);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!visible) {
      setTimeLeft(duration / 1000);
      setProgress(100);
      return;
    }

    // Countdown timer
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0.1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return prev - 0.1;
      });

      setProgress((prev) => {
        const newProgress = (timeLeft / (duration / 1000)) * 100;
        return Math.max(0, newProgress);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [visible, timeLeft, duration, onDismiss]);

  if (!visible) return null;

  return (
    <div 
      className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-slideUp"
      style={{ maxWidth: '90vw', width: '400px' }}
    >
      <div className="bg-gray-900 text-white rounded-xl shadow-2xl overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1 bg-gray-700">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <div className="flex-shrink-0 w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
              <span className="text-xl">🗑️</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{message}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Auto-delete in {Math.ceil(timeLeft)}s
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-4">
            {/* Undo Button */}
            <button 
              onClick={onUndo}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors duration-200 flex items-center space-x-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Undo</span>
            </button>

            {/* Close Button */}
            <button 
              onClick={onDismiss}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default UndoSnackbar;
