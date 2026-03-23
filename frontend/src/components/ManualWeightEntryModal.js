// src/components/ManualWeightEntryModal.js
import React, { useState } from 'react';
import { X, Flame } from 'lucide-react';

// Custom weighing scale icon component (matching Dashboard)
const WeighingScaleIcon = ({ className }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Outer rounded square (scale body) */}
    <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
    {/* Inner dial display area */}
    <path d="M6 10 C6 7, 18 7, 18 10" />
    {/* Dial tick marks */}
    <line x1="8" y1="8.5" x2="8" y2="9.5" />
    <line x1="12" y1="7" x2="12" y2="8" />
    <line x1="16" y1="8.5" x2="16" y2="9.5" />
    {/* Needle pointing up */}
    <line x1="12" y1="12" x2="12" y2="9" />
  </svg>
);

/**
 * Manual Weight Entry Modal
 * Opens when automatic weight detection fails
 * Supports manual BMR entry
 */
const ManualWeightEntryModal = ({ isOpen, onClose, onSave, imagePreview }) => {
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState('kg');
  const [bmr, setBmr] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setError('');

      // Validate weight input
      const weightValue = parseFloat(weight);

      if (!weight || isNaN(weightValue)) {
        setError('Please enter a valid weight');
        return;
      }

      if (weightValue <= 0) {
        setError('Weight must be greater than 0');
        return;
      }

      const minWeight = unit === 'kg' ? 20 : 44;
      const maxWeight = unit === 'kg' ? 300 : 660;

      if (weightValue < minWeight || weightValue > maxWeight) {
        setError(`Weight must be between ${minWeight} and ${maxWeight} ${unit}`);
        return;
      }

      // Validate BMR if provided (optional field)
      let bmrValue = null;
      if (bmr && bmr.trim() !== '') {
        bmrValue = parseFloat(bmr);
        if (isNaN(bmrValue) || bmrValue <= 0) {
          setError('BMR must be a positive number');
          return;
        }
        if (bmrValue < 1100) {
          setError('BMR must be at least 1100 kcal/day');
          return;
        }
      }

      setIsSaving(true);

      // Call parent save handler
      await onSave({
        weightValue,
        unit,
        bmr: bmrValue
      });

      // Reset and close
      setWeight('');
      setUnit('kg');
      setBmr('');
      setError('');
      onClose();

    } catch (err) {
      console.error('❌ Manual entry error:', err);
      setError(err.message || 'Failed to save weight');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setWeight('');
    setUnit('kg');
    setBmr('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <WeighingScaleIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Enter Weight Manually</h2>
              <p className="text-sm text-gray-500">Could not detect weight automatically</p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Image Preview (if available) */}
          {imagePreview && (
            <div className="relative rounded-lg overflow-hidden bg-gray-100">
              <img
                src={imagePreview}
                alt="Weight scale"
                className="w-full h-48 object-contain"
              />
              <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                Auto-detect failed
              </div>
            </div>
          )}

          {/* Manual Entry Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Weight Value
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="e.g., 72.5"
                  autoFocus
                  className="flex-1 min-w-0 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-green-400 focus:outline-none text-lg font-semibold bg-white"
                  style={{ fontSize: '16px' }}
                />
                {/* Custom Toggle Switch for Unit */}
                <div 
                  className="relative flex items-center bg-gray-200 rounded-full p-1 cursor-pointer flex-shrink-0"
                  onClick={() => setUnit(unit === 'kg' ? 'lbs' : 'kg')}
                  style={{ width: '90px', height: '44px' }}
                >
                  {/* Sliding background */}
                  <div 
                    className={`absolute bg-green-500 rounded-full transition-all duration-300 ease-in-out disabled:opacity-50`}
                    style={{ 
                      width: '42px', 
                      height: '36px',
                      left: unit === 'kg' ? '4px' : '44px'
                    }}
                  />
                  {/* Labels */}
                  <span 
                    className={`relative z-10 flex-1 text-center font-bold text-sm transition-colors duration-300 ${
                      unit === 'kg' ? 'text-white' : 'text-gray-500'
                    }`}
                  >
                    kg
                  </span>
                  <span 
                    className={`relative z-10 flex-1 text-center font-bold text-sm transition-colors duration-300 ${
                      unit === 'lbs' ? 'text-white' : 'text-gray-500'
                    }`}
                  >
                    lbs
                  </span>
                </div>
              </div>
            </div>

            

            

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !weight}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isSaving ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                Saving...
              </span>
            ) : (
              'Save Weight'
            )}
          </button>
        </div>

        
      </div>
    </div>
  );
};

export default ManualWeightEntryModal;
