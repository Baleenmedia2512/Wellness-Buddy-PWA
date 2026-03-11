import React from 'react';
import { X, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import TouchFeedbackButton from './TouchFeedbackButton';

/**
 * Custom Alert Modal Component
 * Replaces browser alert() with a styled modal dialog
 * 
 * @param {boolean} isOpen - Whether modal is visible
 * @param {function} onClose - Callback when modal is closed
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @param {string} type - Alert type: 'info' | 'warning' | 'error' | 'success'
 * @param {string} confirmText - Text for confirm button (default: 'OK')
 * @param {string} cancelText - Text for cancel button (optional, hides if null)
 * @param {function} onConfirm - Callback for confirm action
 * @param {function} onCancel - Callback for cancel action
 */
const CustomAlertModal = ({
  isOpen,
  onClose,
  title = 'Alert',
  message,
  type = 'info',
  confirmText = 'OK',
  cancelText = null,
  onConfirm = null,
  onCancel = null,
}) => {
  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    onClose();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    onClose();
  };

  // Get icon and colors based on type
  const getTypeConfig = () => {
    switch (type) {
      case 'warning':
        return {
          icon: <AlertTriangle className="h-12 w-12 text-yellow-600" />,
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          titleColor: 'text-yellow-900',
          buttonColor: 'bg-yellow-600 hover:bg-yellow-700',
        };
      case 'error':
        return {
          icon: <XCircle className="h-12 w-12 text-red-600" />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          titleColor: 'text-red-900',
          buttonColor: 'bg-red-600 hover:bg-red-700',
        };
      case 'success':
        return {
          icon: <CheckCircle className="h-12 w-12 text-green-600" />,
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          titleColor: 'text-green-900',
          buttonColor: 'bg-green-600 hover:bg-green-700',
        };
      default: // info
        return {
          icon: <Info className="h-12 w-12 text-blue-600" />,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          titleColor: 'text-blue-900',
          buttonColor: 'bg-blue-600 hover:bg-blue-700',
        };
    }
  };

  const config = getTypeConfig();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4"
          >
            {/* Modal */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden ${config.borderColor} border-2`}
            >
              {/* Header with colored background */}
              <div className={`${config.bgColor} px-6 pt-6 pb-4 relative`}>
                {/* Close button */}
                <TouchFeedbackButton
                  onClick={onClose}
                  className="absolute top-4 right-4 p-1 rounded-full hover:bg-white hover:bg-opacity-50 transition-colors"
                  ariaLabel="Close"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </TouchFeedbackButton>

                {/* Icon */}
                <div className="flex justify-center mb-4">
                  {config.icon}
                </div>

                {/* Title */}
                <h2 className={`text-xl font-bold text-center ${config.titleColor}`}>
                  {title}
                </h2>
              </div>

              {/* Content */}
              <div className="px-6 py-4">
                <p className="text-gray-700 text-center whitespace-pre-line leading-relaxed">
                  {message}
                </p>
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 flex gap-3">
                {cancelText && (
                  <TouchFeedbackButton
                    onClick={handleCancel}
                    className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                  >
                    {cancelText}
                  </TouchFeedbackButton>
                )}
                <TouchFeedbackButton
                  onClick={handleConfirm}
                  className={`flex-1 px-4 py-3 rounded-lg text-white font-semibold transition-colors ${config.buttonColor}`}
                >
                  {confirmText}
                </TouchFeedbackButton>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CustomAlertModal;
