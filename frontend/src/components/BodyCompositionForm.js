import React, { useState } from 'react';
import { X, Save, Camera, Info } from 'lucide-react';
import { cameraService } from '../services/cameraService';

/**
 * BodyCompositionForm Component
 * Comprehensive form for entering body composition metrics
 */
const BodyCompositionForm = ({ user, apiBaseUrl, onSaved, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  
  // Form state - Basic Metrics
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [bmi, setBmi] = useState('');
  
  // Body Fat Metrics
  const [bodyFat, setBodyFat] = useState('');
  const [subcutaneousFat, setSubcutaneousFat] = useState('');
  const [visceralFat, setVisceralFat] = useState('');
  
  // Muscle Metrics
  const [muscleRate, setMuscleRate] = useState('');
  const [skeletalMuscle, setSkeletalMuscle] = useState('');
  const [muscleMass, setMuscleMass] = useState('');
  
  // Composition Metrics
  const [fatFreeWeight, setFatFreeWeight] = useState('');
  const [boneMass, setBoneMass] = useState('');
  const [protein, setProtein] = useState('');
  const [bodyWater, setBodyWater] = useState('');
  
  // Metabolic Metrics
  const [bmr, setBmr] = useState('');
  const [bodyAge, setBodyAge] = useState('');
  
  // Additional Info
  const [notes, setNotes] = useState('');
  const [measurementCondition, setMeasurementCondition] = useState('');

  /**
   * Calculate status indicators based on values
   */
  const calculateWeightStatus = (bmiValue) => {
    if (!bmiValue) return null;
    const b = parseFloat(bmiValue);
    if (b < 18.5) return 'Underweight';
    if (b < 25) return 'Standard';
    if (b < 30) return 'Overweight';
    return 'Obese';
  };

  const calculateBodyFatStatus = (bodyFatValue) => {
    if (!bodyFatValue) return null;
    const bf = parseFloat(bodyFatValue);
    // Assuming male (you can add gender selection)
    if (bf < 14) return 'Excellent';
    if (bf < 18) return 'Fitness';
    if (bf < 25) return 'Standard';
    return 'High';
  };

  const calculateVisceralFatStatus = (visceralFatValue) => {
    if (!visceralFatValue) return null;
    const vf = parseFloat(visceralFatValue);
    if (vf < 10) return 'Excellent';
    if (vf < 15) return 'Good';
    if (vf < 20) return 'Standard';
    return 'High';
  };

  const calculateMuscleStatus = (muscleRateValue) => {
    if (!muscleRateValue) return null;
    const mr = parseFloat(muscleRateValue);
    if (mr > 75) return 'High';
    if (mr >= 65) return 'Standard';
    return 'Low';
  };

  /**
   * Handle photo capture
   */
  const handleCapturePhoto = async () => {
    try {
      const imageData = await cameraService.takePicture();
      if (imageData) {
        setCapturedImage(imageData);
        console.log('✅ Photo captured');
      }
    } catch (error) {
      console.error('❌ Error capturing photo:', error);
      alert('Failed to capture photo: ' + error.message);
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!weight || isNaN(weight)) {
      alert('Please enter a valid weight');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        userId: user.id,
        // Basic Metrics
        weight: parseFloat(weight),
        weightUnit,
        bmi: bmi ? parseFloat(bmi) : null,
        // Body Fat Metrics
        bodyFatPercentage: bodyFat ? parseFloat(bodyFat) : null,
        subcutaneousFat: subcutaneousFat ? parseFloat(subcutaneousFat) : null,
        visceralFat: visceralFat ? parseFloat(visceralFat) : null,
        // Muscle Metrics
        muscleRate: muscleRate ? parseFloat(muscleRate) : null,
        skeletalMuscle: skeletalMuscle ? parseFloat(skeletalMuscle) : null,
        muscleMass: muscleMass ? parseFloat(muscleMass) : null,
        // Composition Metrics
        fatFreeBodyWeight: fatFreeWeight ? parseFloat(fatFreeWeight) : null,
        boneMass: boneMass ? parseFloat(boneMass) : null,
        protein: protein ? parseFloat(protein) : null,
        bodyWater: bodyWater ? parseFloat(bodyWater) : null,
        // Metabolic Metrics
        bmr: bmr ? parseInt(bmr) : null,
        bodyAge: bodyAge ? parseInt(bodyAge) : null,
        // Status Indicators (calculated)
        weightStatus: calculateWeightStatus(bmi),
        bodyFatStatus: calculateBodyFatStatus(bodyFat),
        muscleStatus: calculateMuscleStatus(muscleRate),
        visceralFatStatus: calculateVisceralFatStatus(visceralFat),
        // Image and Notes
        imageBase64: capturedImage || null,
        notes,
        measurementCondition,
        measurementTime: new Date().toLocaleTimeString('en-US', { hour12: false })
      };

      const response = await fetch(`${apiBaseUrl}/api/save-body-composition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to save body composition');
      }

      console.log('✅ Body composition saved successfully');
      onSaved(data.data);

    } catch (error) {
      console.error('❌ Error saving body composition:', error);
      alert('Failed to save: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-teal-600 text-white p-6 rounded-t-3xl flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold">Body Composition</h2>
            <p className="text-white/90 text-sm">Enter your body metrics</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Photo Section */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">Scale Photo (Optional)</label>
              <button
                type="button"
                onClick={handleCapturePhoto}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                <Camera className="w-4 h-4" />
                {capturedImage ? 'Retake' : 'Take Photo'}
              </button>
            </div>
            {capturedImage && (
              <img 
                src={capturedImage} 
                alt="Scale" 
                className="w-full h-40 object-cover rounded-lg"
              />
            )}
          </div>

          {/* Basic Metrics */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              Basic Metrics
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="73.5"
                    required
                  />
                  <select
                    value={weightUnit}
                    onChange={(e) => setWeightUnit(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="kg">kg</option>
                    <option value="lbs">lbs</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">BMI</label>
                <input
                  type="number"
                  step="0.1"
                  value={bmi}
                  onChange={(e) => setBmi(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="22.6"
                />
              </div>
            </div>
          </div>

          {/* Body Fat Metrics */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Body Fat Metrics</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body Fat %</label>
                <input
                  type="number"
                  step="0.1"
                  value={bodyFat}
                  onChange={(e) => setBodyFat(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="15.8"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subcutaneous %</label>
                <input
                  type="number"
                  step="0.1"
                  value={subcutaneousFat}
                  onChange={(e) => setSubcutaneousFat(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="14.0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visceral Fat</label>
                <input
                  type="number"
                  step="0.1"
                  value={visceralFat}
                  onChange={(e) => setVisceralFat(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="5.7"
                />
              </div>
            </div>
          </div>

          {/* Muscle Metrics */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Muscle Metrics</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Muscle Rate %</label>
                <input
                  type="number"
                  step="0.1"
                  value={muscleRate}
                  onChange={(e) => setMuscleRate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="80.0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skeletal Muscle %</label>
                <input
                  type="number"
                  step="0.1"
                  value={skeletalMuscle}
                  onChange={(e) => setSkeletalMuscle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="54.4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Muscle Mass (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={muscleMass}
                  onChange={(e) => setMuscleMass(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="58.6"
                />
              </div>
            </div>
          </div>

          {/* Additional Composition */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Additional Metrics</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fat-Free (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={fatFreeWeight}
                  onChange={(e) => setFatFreeWeight(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="61.7"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bone Mass (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={boneMass}
                  onChange={(e) => setBoneMass(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="3.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Protein %</label>
                <input
                  type="number"
                  step="0.1"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="19.2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body Water %</label>
                <input
                  type="number"
                  step="0.1"
                  value={bodyWater}
                  onChange={(e) => setBodyWater(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="60.8"
                />
              </div>
            </div>
          </div>

          {/* Metabolic Metrics */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Metabolic Data</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">BMR (kcal)</label>
                <input
                  type="number"
                  value={bmr}
                  onChange={(e) => setBmr(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="1703"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body Age</label>
                <input
                  type="number"
                  value={bodyAge}
                  onChange={(e) => setBodyAge(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="37"
                />
              </div>
            </div>
          </div>

          {/* Notes and Condition */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Measurement Condition</label>
              <select
                value={measurementCondition}
                onChange={(e) => setMeasurementCondition(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select condition...</option>
                <option value="Morning - Before breakfast">Morning - Before breakfast</option>
                <option value="Morning - After breakfast">Morning - After breakfast</option>
                <option value="Afternoon">Afternoon</option>
                <option value="Evening - Before dinner">Evening - Before dinner</option>
                <option value="Evening - After dinner">Evening - After dinner</option>
                <option value="Before workout">Before workout</option>
                <option value="After workout">After workout</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                rows="3"
                placeholder="Add any notes about this measurement..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-teal-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-teal-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Data
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default BodyCompositionForm;
