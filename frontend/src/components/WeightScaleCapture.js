import React, { useState, useEffect } from 'react';
import { Scale, Camera, AlertCircle, CheckCircle, X, Loader } from 'lucide-react';
import { cameraService } from '../services/cameraService';
import weightOcrService from '../services/weightOcrService';

/**
 * WeightScaleCapture Component
 * Captures weighing scale photos and extracts weight using OCR
 */
const WeightScaleCapture = ({ user, apiBaseUrl, onWeightSaved, onClose }) => {
  const [capturedImage, setCapturedImage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [manualWeight, setManualWeight] = useState('');
  const [unit, setUnit] = useState('kg');
  const [notes, setNotes] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Initialize OCR on component mount
  useEffect(() => {
    weightOcrService.initialize().catch(err => {
      console.error('Failed to initialize OCR:', err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Handle camera capture
   */
  const handleTakePhoto = async () => {
    try {
      setError(null);
      console.log('📸 Opening camera for weighing scale photo...');

      const result = await cameraService.takePhoto();

      if (!result.success) {
        setError(result.error || 'Failed to capture photo');
        return;
      }

      console.log('✅ Photo captured successfully');
      setCapturedImage(result.src);

      // Automatically start OCR processing
      await processOcr(result.src);

    } catch (err) {
      console.error('❌ Camera error:', err);
      setError('Failed to access camera. Please check permissions.');
    }
  };

  /**
   * Process OCR on captured image
   */
  const processOcr = async (imageSource) => {
    try {
      setProcessing(true);
      setError(null);
      console.log('🔍 Starting OCR weight extraction...');

      const result = await weightOcrService.extractWeight(imageSource);

      console.log('OCR Result:', result);
      setOcrResult(result);

      if (result.success) {
        console.log(`✅ Weight detected: ${result.weight} ${result.unit}`);
        setManualWeight(result.weight.toString());
        setUnit(result.unit);
      } else {
        console.log('⚠️ OCR failed to detect weight');
        setError(result.error || 'Unable to detect weight. Please enter manually.');
        setShowManualEntry(true);
      }

    } catch (err) {
      console.error('❌ OCR processing error:', err);
      setError('OCR processing failed. Please enter weight manually.');
      setShowManualEntry(true);
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Retry OCR processing
   */
  const handleRetryOcr = async () => {
    if (capturedImage) {
      await processOcr(capturedImage);
    }
  };

  /**
   * Save weight entry to database
   */
  const handleSaveWeight = async () => {
    try {
      // Validate weight input
      const weightValue = parseFloat(manualWeight);
      if (isNaN(weightValue) || weightValue <= 0) {
        setError('Please enter a valid weight value');
        return;
      }

      // Validate weight range
      if (unit === 'kg' && (weightValue < 20 || weightValue > 300)) {
        setError('Weight must be between 20-300 kg');
        return;
      }

      if (unit === 'lbs' && (weightValue < 44 || weightValue > 660)) {
        setError('Weight must be between 44-660 lbs');
        return;
      }

      setSaving(true);
      setError(null);

      console.log('💾 Saving weight entry:', {
        userId: user?.id,
        weight: weightValue,
        unit
      });

      // Convert image to base64 if needed
      let imageBase64 = null;
      if (capturedImage && capturedImage.startsWith('data:')) {
        imageBase64 = capturedImage;
      }

      const payload = {
        userId: user?.id,
        weightValue: weightValue,
        weightUnit: unit,
        imageBase64: imageBase64,
        ocrConfidence: ocrResult?.confidence || null,
        ocrRawText: ocrResult?.rawText || null,
        deviceInfo: navigator.userAgent,
        notes: notes || null
      };

      const response = await fetch(`${apiBaseUrl}/api/save-weight-entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to save weight entry');
      }

      console.log('✅ Weight entry saved successfully');

      // Notify parent component
      if (onWeightSaved) {
        onWeightSaved(data.data);
      }

      // Close modal
      if (onClose) {
        onClose();
      }

    } catch (err) {
      console.error('❌ Error saving weight:', err);
      setError(err.message || 'Failed to save weight entry');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Retake photo
   */
  const handleRetake = () => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setOcrResult(null);
    setError(null);
    setManualWeight('');
    setNotes('');
    setShowManualEntry(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-teal-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scale className="w-6 h-6" />
            <h2 className="text-xl font-bold">Weighing Scale</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Camera Capture Section */}
          {!capturedImage && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-100 to-teal-100 rounded-full flex items-center justify-center mb-4">
                  <Scale className="w-16 h-16 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Take Photo of Your Weighing Scale
                </h3>
                <p className="text-sm text-gray-600">
                  Point your camera at the scale display and capture a clear photo
                </p>
              </div>

              <button
                onClick={handleTakePhoto}
                className="bg-gradient-to-r from-blue-500 to-teal-600 text-white py-3 px-8 rounded-xl font-semibold shadow-lg hover:from-blue-600 hover:to-teal-700 transition-all duration-200 flex items-center justify-center gap-2 mx-auto"
              >
                <Camera className="w-5 h-5" />
                Take Photo
              </button>
            </div>
          )}

          {/* Image Preview and OCR Result */}
          {capturedImage && (
            <div className="space-y-4">
              
              {/* Image Preview */}
              <div className="relative">
                <img
                  src={capturedImage}
                  alt="Weighing scale"
                  className="w-full rounded-lg shadow-md"
                />
                <button
                  onClick={handleRetake}
                  className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full shadow-lg hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* OCR Processing */}
              {processing && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                  <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                  <div>
                    <p className="font-semibold text-blue-900">Detecting weight...</p>
                    <p className="text-sm text-blue-700">Please wait while we read the scale</p>
                  </div>
                </div>
              )}

              {/* OCR Success */}
              {ocrResult && ocrResult.success && !processing && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-green-900 mb-1">Weight Detected!</p>
                      <p className="text-2xl font-bold text-green-700">
                        {ocrResult.weight} {ocrResult.unit}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Confidence: {Math.round(ocrResult.confidence)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* OCR Failed or Manual Entry */}
              {(error || showManualEntry || (ocrResult && !ocrResult.success)) && !processing && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-yellow-900">Manual Entry Required</p>
                      <p className="text-sm text-yellow-700">
                        {error || 'Unable to detect weight automatically'}
                      </p>
                    </div>
                  </div>
                  {ocrResult && !ocrResult.success && (
                    <button
                      onClick={handleRetryOcr}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      🔄 Retry OCR
                    </button>
                  )}
                </div>
              )}

              {/* Weight Input Form */}
              <div className="space-y-4 bg-gray-50 rounded-lg p-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Weight Value
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={manualWeight}
                      onChange={(e) => setManualWeight(e.target.value)}
                      placeholder="Enter weight"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="kg">kg</option>
                      <option value="lbs">lbs</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes about this measurement..."
                    rows="2"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleRetake}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                >
                  Retake Photo
                </button>
                <button
                  onClick={handleSaveWeight}
                  disabled={saving || !manualWeight}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-teal-600 text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:from-blue-600 hover:to-teal-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Save Weight
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && !capturedImage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-900">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default WeightScaleCapture;
