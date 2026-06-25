import React from 'react';
import { MapPin, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

const ClubSelectionModal = ({ isOpen, onClose, nearbyCenters, onSelectClub }) => {
  if (!isOpen) return null;

  const handleSelect = (center) => {
    onSelectClub(center.center);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 relative">
              <TouchFeedbackButton
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
                ariaLabel="Close"
              >
                <X className="w-5 h-5 text-white" />
              </TouchFeedbackButton>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Select Your Club</h2>
                  <p className="text-green-50 text-sm">
                    {nearbyCenters.length} club{nearbyCenters.length > 1 ? 's' : ''} found nearby
                  </p>
                </div>
              </div>
            </div>

            {/* Club List */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-3">
                {nearbyCenters.map((item, index) => (
                  <TouchFeedbackButton
                    key={item.center.id}
                    onClick={() => handleSelect(item)}
                    className="w-full bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border-2 border-green-200 hover:border-green-400 rounded-xl p-4 transition-all duration-200 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg font-bold text-green-700">
                            {item.center.center_name}
                          </span>
                          {index === 0 && (
                            <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                              Closest
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {item.center.address}
                        </p>
                        <div className="flex items-center gap-1 text-green-600">
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {Math.round(item.distance)}m away
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-200 text-green-700 font-bold text-sm">
                        {index + 1}
                      </div>
                    </div>
                  </TouchFeedbackButton>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 pt-0">
              <p className="text-xs text-gray-500 text-center">
                Select the club you're attending today
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ClubSelectionModal;
