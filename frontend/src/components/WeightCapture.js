// src/components/WeightCapture.js
import React, { useState, useRef } from 'react';
import { cameraService } from '../services/cameraService';
import { weightOcrService } from '../services/weightOcrService';

const WeightCapture = ({ user, apiBaseUrl, onWeightSaved }) => {
  const [imagePreview, setImagePreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [manualWeight, setManualWeight] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState('kg');

  const fileInputRef = useRef(null);

  /**
   * Handle camera capture button click
   */
  const handleCameraClick = async () => {
    try {
      setError(null);
      setOcrResult(null);
      setImagePreview(null);
      setShowManualEntry(false);

      // Take photo using camera service (camera only, no gallery)
      const result = await cameraService.takePhoto();

      if (!result.success) {
        setError(result.error || 'Failed to capture photo');
        return;
      }

      // Set image preview
      setImagePreview(result.src);

      // Start OCR processing
      await processImageWithOCR(result.file);

    } catch (err) {
      console.error('Camera capture error:', err);
      setError('Failed to access camera. Please check permissions.');
    }
  };

  /**
   * Process image with OCR to extract weight
   */
  const processImageWithOCR = async (imageFile) => {
    try {
      setIsProcessing(true);
      setError(null);

      console.log('🔍 Processing image with OCR...');

      // Extract weight from image using OCR
      const result = await weightOcrService.extractWeightFromImage(imageFile);

      console.log('OCR Result:', result);

      if (result.success) {
        setOcrResult(result);
        setSelectedUnit(result.unit);
        setManualWeight(result.weightValue.toString());
      } else {
        setError(result.error || 'Unable to detect weight. Please retake the photo or enter weight manually.');
        setShowManualEntry(true);
      }

    } catch (err) {
      console.error('OCR processing error:', err);
      setError('OCR processing failed. Please try again or enter weight manually.');
      setShowManualEntry(true);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handle manual weight input change
   */
  const handleManualWeightChange = (e) => {
    const value = e.target.value;
    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setManualWeight(value);
      setError(null);
    }
  };

  /**
   * Validate and save weight entry
   */
  const handleSaveWeight = async () => {
    try {
      setError(null);
      setIsSaving(true);

      // Get weight value (from OCR or manual entry)
      const weightValue = manualWeight ? parseFloat(manualWeight) : ocrResult?.weightValue;

      if (!weightValue) {
        setError('Please enter a valid weight value');
        setIsSaving(false);
        return;
      }

      // Validate weight
      const validation = weightOcrService.validateWeight(weightValue, selectedUnit);
      if (!validation.valid) {
        setError(validation.error);
        setIsSaving(false);
        return;
      }

      if (!imagePreview) {
        setError('No image captured. Please take a photo first.');
        setIsSaving(false);
        return;
      }

      // Prepare data to save
      const userId = user.email || user.id || user.uid;

      const payload = {
        userId,
        weightValue,
        unit: selectedUnit,
        imagePath: `weight_${Date.now()}.jpg`,
        imageBase64: imagePreview,
        confidenceScore: ocrResult?.confidence || 0,
        notes: null
      };

      console.log('💾 Saving weight entry...', { userId, weightValue, unit: selectedUnit });

      // Call backend API to save weight entry
      const response = await fetch(`${apiBaseUrl}/api/save-weight-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to save weight entry');
      }

      console.log('✅ Weight saved successfully:', data);

      // Show success message
      alert(`✅ Weight saved: ${weightValue} ${selectedUnit}`);

      // Reset form
      resetForm();

      // Notify parent component
      if (onWeightSaved) {
        onWeightSaved(data);
      }

    } catch (err) {
      console.error('❌ Save weight error:', err);
      setError(err.message || 'Failed to save weight. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Reset form
   */
  const resetForm = () => {
    setImagePreview(null);
    setOcrResult(null);
    setError(null);
    setManualWeight('');
    setShowManualEntry(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Handle retake photo
   */
  const handleRetake = () => {
    resetForm();
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-green-700">📊 Weight Tracking</h2>
      </div>

      {/* Camera Capture Button */}
      {!imagePreview && (
        <div className="space-y-4">
          <button
            onClick={handleCameraClick}
            disabled={isProcessing}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Take Photo of Weighing Scale</span>
          </button>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-700 mb-2">📸 Tips for best results:</h3>
            <ul className="text-sm text-blue-600 space-y-1 list-disc list-inside">
              <li>Ensure good lighting on the scale display</li>
              <li>Keep the camera steady and focused</li>
              <li>Make sure the numbers are clearly visible</li>
              <li>Avoid reflections or shadows on the display</li>
            </ul>
          </div>
        </div>
      )}

      {/* Image Preview */}
      {imagePreview && (
        <div className="space-y-4">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Weighing Scale"
              className="w-full h-64 object-cover rounded-lg border-2 border-green-200"
            />
            {isProcessing && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
                  <p>Processing OCR...</p>
                </div>
              </div>
            )}
          </div>

          {/* OCR Result Display */}
          {ocrResult && !isProcessing && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-green-700">✅ Weight Detected</h3>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                  {Math.round(ocrResult.confidence * 100)}% confidence
                </span>
              </div>
              <div className="text-3xl font-bold text-green-700">
                {ocrResult.weightValue} {ocrResult.unit}
              </div>
              {ocrResult.rawText && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-500 cursor-pointer">Show OCR raw text</summary>
                  <p className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded">
                    {ocrResult.rawText}
                  </p>
                </details>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <span className="text-red-600">⚠️</span>
                <div className="flex-1">
                  <p className="text-red-700 font-medium">Error</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Manual Entry */}
          {(showManualEntry || ocrResult) && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">
                  Weight Value:
                </label>
                <input
                  type="text"
                  value={manualWeight}
                  onChange={handleManualWeightChange}
                  placeholder="Enter weight"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <select
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="kg">kg</option>
                  <option value="lbs">lbs</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={handleSaveWeight}
                  disabled={isSaving || !manualWeight}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : '💾 Save Weight'}
                </button>
                <button
                  onClick={handleRetake}
                  disabled={isSaving}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔄 Retake Photo
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WeightCapture;
