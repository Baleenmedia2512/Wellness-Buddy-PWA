// src/components/ManualWeightEntryModal.js
import React, { useState } from 'react';
import { X, Scale, Flame } from 'lucide-react';

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
        if (bmrValue < 1100 || bmrValue > 2200) {
          setError('BMR must be between 1100 and 2200 kcal/day');
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
            <div className="p-2 bg-purple-100 rounded-lg">
              <Scale className="w-6 h-6 text-purple-600" />
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
              <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full">
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
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="e.g., 72.5"
                  autoFocus
                  className="flex-1 min-w-0 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-400 focus:outline-none text-lg font-semibold bg-white"
                  style={{ fontSize: '16px' }}
                />
                {/* Custom Unit Toggle Buttons */}
                <div className="flex border-2 border-gray-300 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setUnit('kg')}
                    className={`px-4 py-3 font-semibold text-base transition-all ${
                      unit === 'kg'
                        ? 'bg-purple-500 text-white'
                        : 'bg-transparent text-gray-600 hover:bg-gray-200'
                    }`}
                    style={{ minWidth: '50px' }}
                  >
                    kg
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnit('lbs')}
                    className={`px-4 py-3 font-semibold text-base transition-all ${
                      unit === 'lbs'
                        ? 'bg-purple-500 text-white'
                        : 'bg-transparent text-gray-600 hover:bg-gray-200'
                    }`}
                    style={{ minWidth: '50px' }}
                  >
                    lbs
                  </button>
                </div>
              </div>
            </div>

            {/* BMR Input (Optional) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  BMR (Optional)
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  step="1"
                  value={bmr}
                  onChange={(e) => setBmr(e.target.value)}
                  placeholder="e.g., 1650"
                  className="flex-1 min-w-0 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-orange-400 focus:outline-none text-lg font-semibold bg-white"
                  style={{ fontSize: '16px' }}
                />
                <span className="px-4 py-3 bg-gray-100 border-2 border-gray-300 rounded-xl text-gray-600 font-semibold flex-shrink-0">
                  kcal
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Basal Metabolic Rate from your scale (if displayed)
              </p>
            </div>

            {/* Helper Text */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <strong>Valid ranges:</strong><br />
                • kg: 20 - 300 kg<br />
                • lbs: 44 - 660 lbs<br />
                • BMR: 1100 - 2200 kcal/day (optional)
              </p>
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
            className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-800 rounded-lg font-semibold hover:from-yellow-500 hover:to-yellow-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isSaving ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-800 border-t-transparent mr-2"></div>
                Saving...
              </span>
            ) : (
              'Save Weight'
            )}
          </button>
        </div>

        {/* Quick Tips */}
        <div className="px-6 pb-6">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
            <p className="text-xs text-purple-800 font-medium mb-2">💡 Tips for better detection:</p>
            <ul className="text-xs text-purple-700 space-y-1">
              <li>• Ensure good lighting on the scale display</li>
              <li>• Take photo from directly above the scale</li>
              <li>• Make sure numbers are clearly visible</li>
              <li>• Avoid glare or shadows on the display</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualWeightEntryModal;
