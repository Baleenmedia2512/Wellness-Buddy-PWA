/**
 * WeightProgressTipsModal.jsx
 * Modal showing weight progress comparison and actionable tips.
 * 
 * Displays:
 * - Nutrition comparison (calories, carbs, fat, protein) with OK buttons
 * - Water intake question (Yes/No)
 * - Sleep hours input (optional)
 * - Workout calories input
 * - Activity proof upload
 */
import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

export function WeightProgressTipsModal({
  isOpen,
  onClose,
  comparison,
  tips,
  goalMode,
}) {
  const [acknowledgedNutrition, setAcknowledgedNutrition] = useState({
    calories: false,
    carbs: false,
    fat: false,
    protein: false,
  });
  const [waterAnswer, setWaterAnswer] = useState(null); // null | 'yes' | 'no'
  const [sleepHours, setSleepHours] = useState('');
  const [workoutAnswer, setWorkoutAnswer] = useState(null); // null | 'yes' | 'no'
  const [workoutCalories, setWorkoutCalories] = useState('');
  const [activityType, setActivityType] = useState('');

  if (!isOpen || !comparison) return null;

  const isFirstUpload = comparison.weight.direction === 'first';

  const handleAcknowledgeNutrition = (nutrient) => {
    setAcknowledgedNutrition((prev) => ({
      ...prev,
      [nutrient]: true,
    }));
  };

  const allNutritionAcknowledged = Object.values(acknowledgedNutrition).every(Boolean);

  const handleSubmit = () => {
    // TODO: Submit responses to backend for tracking
    console.log('User responses:', {
      acknowledgedNutrition,
      waterAnswer,
      sleepHours,
      workoutAnswer,
      workoutCalories,
      activityType,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className={`sticky top-0 ${isFirstUpload ? 'bg-gradient-to-r from-green-500 to-blue-500' : 'bg-gradient-to-r from-orange-500 to-red-500'} text-white p-6 rounded-t-2xl`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition"
          >
            <X size={24} />
          </button>
          <div className="flex items-center gap-3">
            {isFirstUpload ? <CheckCircle size={32} /> : <AlertCircle size={32} />}
            <div>
              <h2 className="text-2xl font-bold">
                {isFirstUpload ? '🎉 Welcome to Your Journey!' : 'Weight Progress Alert'}
              </h2>
              <p className="text-sm opacity-90">
                {isFirstUpload 
                  ? `Starting weight: ${comparison.weight.current} kg - Let's achieve your ${goalMode} goal!`
                  : `Your weight moved in the opposite direction of your ${goalMode} goal`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Weight Change Summary */}
          {!isFirstUpload && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">Previous Weight</p>
                  <p className="text-2xl font-bold">{comparison.weight.previous} kg</p>
                </div>
                <div className="text-3xl">→</div>
                <div>
                  <p className="text-sm text-gray-600">Current Weight</p>
                  <p className="text-2xl font-bold text-orange-600">{comparison.weight.current} kg</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Change</p>
                  <p className={`text-2xl font-bold ${comparison.weight.direction === 'increase' ? 'text-red-600' : 'text-green-600'}`}>
                    {comparison.weight.change > 0 ? '+' : ''}{comparison.weight.change} kg
                  </p>
                </div>
              </div>
            </div>
          )}

          {isFirstUpload && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">Starting Weight</p>
                <p className="text-4xl font-bold text-green-600">{comparison.weight.current} kg</p>
                <p className="text-sm text-gray-500 mt-2">Your journey begins here! 🚀</p>
              </div>
            </div>
          )}

          {/* Nutrition Comparison - Skip for first upload */}
          {!isFirstUpload && (
            <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span>📊</span> Nutrition Comparison (Yesterday vs Target)
            </h3>
            <div className="space-y-3">
              {/* Calories */}
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <div>
                  <p className="font-medium">Calories</p>
                  <p className="text-sm text-gray-600">
                    Target: ~{Math.round(comparison.nutrition.yesterday.calories * 0.9)} kcal, 
                    Your intake: {Math.round(comparison.nutrition.yesterday.calories)} kcal
                  </p>
                </div>
                <button
                  onClick={() => handleAcknowledgeNutrition('calories')}
                  disabled={acknowledgedNutrition.calories}
                  className={`px-6 py-2 rounded-lg font-medium transition ${
                    acknowledgedNutrition.calories
                      ? 'bg-green-500 text-white'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {acknowledgedNutrition.calories ? <CheckCircle size={20} /> : 'OK'}
                </button>
              </div>

              {/* Carbs */}
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <div>
                  <p className="font-medium">Carbohydrates</p>
                  <p className="text-sm text-gray-600">
                    Target: ~{Math.round(comparison.nutrition.yesterday.carbs * 0.9)} g, 
                    Your intake: {Math.round(comparison.nutrition.yesterday.carbs)} g
                  </p>
                </div>
                <button
                  onClick={() => handleAcknowledgeNutrition('carbs')}
                  disabled={acknowledgedNutrition.carbs}
                  className={`px-6 py-2 rounded-lg font-medium transition ${
                    acknowledgedNutrition.carbs
                      ? 'bg-green-500 text-white'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {acknowledgedNutrition.carbs ? <CheckCircle size={20} /> : 'OK'}
                </button>
              </div>

              {/* Fat */}
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <div>
                  <p className="font-medium">Fat</p>
                  <p className="text-sm text-gray-600">
                    Target: ~{Math.round(comparison.nutrition.yesterday.fat * 0.9)} g, 
                    Your intake: {Math.round(comparison.nutrition.yesterday.fat)} g
                  </p>
                </div>
                <button
                  onClick={() => handleAcknowledgeNutrition('fat')}
                  disabled={acknowledgedNutrition.fat}
                  className={`px-6 py-2 rounded-lg font-medium transition ${
                    acknowledgedNutrition.fat
                      ? 'bg-green-500 text-white'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {acknowledgedNutrition.fat ? <CheckCircle size={20} /> : 'OK'}
                </button>
              </div>

              {/* Protein */}
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                <div>
                  <p className="font-medium">Protein</p>
                  <p className="text-sm text-gray-600">
                    Target: ~{Math.round(comparison.nutrition.yesterday.protein * 1.1)} g, 
                    Your intake: {Math.round(comparison.nutrition.yesterday.protein)} g
                  </p>
                </div>
                <button
                  onClick={() => handleAcknowledgeNutrition('protein')}
                  disabled={acknowledgedNutrition.protein}
                  className={`px-6 py-2 rounded-lg font-medium transition ${
                    acknowledgedNutrition.protein
                      ? 'bg-green-500 text-white'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {acknowledgedNutrition.protein ? <CheckCircle size={20} /> : 'OK'}
                </button>
              </div>
            </div>
          </div>
          )}

          {/* Water Question */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span>💧</span> Water Intake
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="mb-3">
                Did you drink at least {Math.round(comparison.water.target / 1000)} liters of water yesterday?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setWaterAnswer('yes')}
                  className={`flex-1 py-3 rounded-lg font-medium transition ${
                    waterAnswer === 'yes'
                      ? 'bg-green-500 text-white'
                      : 'bg-white border-2 border-gray-300 hover:border-green-500'
                  }`}
                >
                  YES
                </button>
                <button
                  onClick={() => setWaterAnswer('no')}
                  className={`flex-1 py-3 rounded-lg font-medium transition ${
                    waterAnswer === 'no'
                      ? 'bg-red-500 text-white'
                      : 'bg-white border-2 border-gray-300 hover:border-red-500'
                  }`}
                >
                  NO
                </button>
              </div>
            </div>
          </div>

          {/* Sleep Question (Optional) */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span>😴</span> Sleep (Optional)
            </h3>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="mb-3">How many hours did you sleep last night?</p>
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                placeholder="e.g., 7.5"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Workout Question */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span>🏋️</span> Workout
            </h3>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <p>Did you workout yesterday?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setWorkoutAnswer('yes')}
                  className={`flex-1 py-3 rounded-lg font-medium transition ${
                    workoutAnswer === 'yes'
                      ? 'bg-green-500 text-white'
                      : 'bg-white border-2 border-gray-300 hover:border-green-500'
                  }`}
                >
                  YES
                </button>
                <button
                  onClick={() => setWorkoutAnswer('no')}
                  className={`flex-1 py-3 rounded-lg font-medium transition ${
                    workoutAnswer === 'no'
                      ? 'bg-red-500 text-white'
                      : 'bg-white border-2 border-gray-300 hover:border-red-500'
                  }`}
                >
                  NO
                </button>
              </div>
              
              {workoutAnswer === 'yes' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Calories burned (kcal)</label>
                  <input
                    type="number"
                    min="0"
                    value={workoutCalories}
                    onChange={(e) => setWorkoutCalories(e.target.value)}
                    placeholder="e.g., 300"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Activity Upload */}
          {workoutAnswer === 'yes' && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span>📸</span> Activity Proof
              </h3>
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Activity Type</label>
                  <select
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Select activity type</option>
                    <option value="gym">Gym</option>
                    <option value="running">Running</option>
                    <option value="cycling">Cycling</option>
                    <option value="swimming">Swimming</option>
                    <option value="yoga">Yoga</option>
                    <option value="sports">Sports</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <button className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition">
                  Upload Photo / Video
                </button>
              </div>
            </div>
          )}

          {/* Generated Tips */}
          {tips && tips.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span>💡</span> Actionable Tips
              </h3>
              <div className="space-y-2">
                {tips.map((tip, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-l-4 ${
                      tip.priority === 'high'
                        ? 'bg-red-50 border-red-500'
                        : tip.priority === 'medium'
                        ? 'bg-yellow-50 border-yellow-500'
                        : 'bg-blue-50 border-blue-500'
                    }`}
                  >
                    <p className="font-medium">{tip.tip}</p>
                    <p className="text-sm text-gray-600 mt-1">Priority: {tip.priority}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 rounded-b-2xl flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFirstUpload && !allNutritionAcknowledged}
            className={`flex-1 py-3 rounded-lg font-medium transition ${
              (isFirstUpload || allNutritionAcknowledged)
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Submit Responses
          </button>
        </div>
      </div>
    </div>
  );
}
