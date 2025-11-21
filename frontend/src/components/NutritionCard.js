//src\components\NutritionCard.js
import React, { useState, useCallback } from 'react';
import EditableFoodItem from './EditableFoodItem';
import { Bookmark, Copy, Search, X, Check } from 'lucide-react';
import { getUserId } from '../services/getUserId';

const NutritionCard = ({ data, onDataUpdate, user, imagePreview, selectedImage, onSaveSuccess }) => {
  // Local state for editable food items (must be before early return)
  const [localDetailedItems, setLocalDetailedItems] = useState(data?.detailedItems || []);
  const [localNutrition, setLocalNutrition] = useState(data?.nutrition || {});
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [mealName, setMealName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null
  const [isClosing, setIsClosing] = useState(false);
  const [editingStates, setEditingStates] = useState({});

  // Handle editing state change from EditableFoodItem - wrapped in useCallback to prevent re-creation
  const handleEditingChange = useCallback((index, isItemEditing) => {
    setEditingStates(prev => ({
      ...prev,
      [index]: isItemEditing
    }));
  }, []);

  // Derive editing index from editing states
  const editingIndex = Object.keys(editingStates).find(key => editingStates[key]) 
    ? parseInt(Object.keys(editingStates).find(key => editingStates[key])) 
    : null;

  // Generate meal name from food items
  const generateMealName = () => {
    if (localDetailedItems.length === 0) return data?.category?.name || 'Meal';
    if (localDetailedItems.length === 1) return localDetailedItems[0].name;
    
    const firstItem = localDetailedItems[0].name;
    const remaining = localDetailedItems.length - 1;
    return `${firstItem} + ${remaining} more`;
  };

  // Recalculate total nutrition from all food items
  const recalculateTotals = (items) => {
    const totals = items.reduce((acc, item) => ({
      calories: acc.calories + (item.nutrition?.calories || item.calories || 0),
      protein: acc.protein + (item.nutrition?.protein || item.protein || 0),
      carbs: acc.carbs + (item.nutrition?.carbs || item.carbs || 0),
      fat: acc.fat + (item.nutrition?.fat || item.fat || 0),
      fiber: acc.fiber + (item.nutrition?.fiber || item.fiber || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
    
    // Round to 1 decimal
    return {
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein * 10) / 10,
      carbs: Math.round(totals.carbs * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
      fiber: Math.round(totals.fiber * 10) / 10
    };
  };

  // Handle food item update
  const handleFoodUpdate = (index, updatedFood) => {
    console.log('🔄 [NutritionCard] Updating food item at index:', index);
    
    const newItems = [...localDetailedItems];
    newItems[index] = {
      ...newItems[index],
      ...updatedFood,
      // Preserve original fields if not in updatedFood
      calories: updatedFood.nutrition?.calories || updatedFood.calories,
      protein: updatedFood.nutrition?.protein || updatedFood.protein,
      carbs: updatedFood.nutrition?.carbs || updatedFood.carbs,
      fat: updatedFood.nutrition?.fat || updatedFood.fat,
      fiber: updatedFood.nutrition?.fiber || updatedFood.fiber
    };
    
    setLocalDetailedItems(newItems);
    
    // Recalculate totals
    const newTotals = recalculateTotals(newItems);
    setLocalNutrition(newTotals);
    
    console.log('✅ [NutritionCard] Updated totals:', newTotals);
  };

  // Handle modal close with animation
  const handleCloseModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowSaveModal(false);
      setIsClosing(false);
      setSaveStatus(null);
    }, 300);
  };

  // Handle save meal
  const handleSaveMeal = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    
    try {
      // Get the database userId using the same method as rest of the app
      if (!user) {
        throw new Error('User not logged in. Please log in to save meals.');
      }

      // Get database UserId from team_table using email lookup
      const dbUserId = await getUserId(user);
      
      if (!dbUserId) {
        throw new Error('Unable to retrieve user information. Please try logging in again.');
      }
      
      // Prepare the analysis data in the format expected by the API
      const analysisData = {
        foods: localDetailedItems.map(item => ({
          name: item.name,
          portion: item.serving?.description || item.portionDescription || item.portion || '1 serving',
          weight_g: item.serving?.grams || item.grams || item.weight_g || 100, // Use actual grams
          nutrition: {
            calories: Math.round(item.nutrition?.calories || item.calories || 0),
            protein: Math.round(item.nutrition?.protein || item.protein || 0),
            carbs: Math.round(item.nutrition?.carbs || item.carbs || 0),
            fat: Math.round(item.nutrition?.fat || item.fat || 0),
            fiber: Math.round(item.nutrition?.fiber || item.fiber || 0)
          }
        })),
        total: {
          calories: Math.round(localNutrition.calories || 0),
          protein: Math.round(localNutrition.protein || 0),
          carbs: Math.round(localNutrition.carbs || 0),
          fat: Math.round(localNutrition.fat || 0),
          fiber: Math.round(localNutrition.fiber || 0)
        },
        confidence: 'high'
      };

      // Prepare API request body
      const requestBody = {
        userId: dbUserId,
        imagePath: selectedImage?.name || `${Date.now()}.jpg`, // Use original filename
        analysisResult: analysisData,
        timestamp: new Date().toISOString(),
        deviceInfo: 'Wellness Buddy Web App - Manual Save',
        ImageBase64: imagePreview || '' // Include the base64 image if available
      };

      // Call the save API
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${apiBaseUrl}/api/save-background-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to save meal');
      }

      console.log('💾 Meal saved successfully:', result);
      
      setSaveStatus('success');
      
      // Auto-close after showing success
      setTimeout(() => {
        setIsClosing(true);
        setTimeout(() => {
          setShowSaveModal(false);
          setSaveStatus(null);
          setIsSaving(false);
          setIsClosing(false);
          
          // Reset the page to default after successful save
          if (onSaveSuccess) {
            onSaveSuccess();
          }
        }, 300);
      }, 2000);
    } catch (error) {
      console.error('❌ Error saving meal:', error);
      setSaveStatus('error');
      
      // Auto-reset error after 3 seconds
      setTimeout(() => {
        setSaveStatus(null);
        setIsSaving(false);
      }, 3000);
    }
  };

  // Early return after hooks
  if (!data) return null;

  const { nutrition, category, servingInfo, itemCount, detailedItems, portionAnalysis } = data;

  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-green-300 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <h2 className="text-xl font-bold">
              {generateMealName()}
            </h2>
            {localDetailedItems.length > 1 && (
              <p className="text-green-100 text-sm mt-1">
                {localDetailedItems.length} food items analyzed
              </p>
            )}
            {servingInfo && (
              <p className="text-green-100 text-sm">
                Per {servingInfo.description || '100g'}
              </p>
            )}
          </div>
          
          {/* Save Button */}
          <button
            onClick={() => setShowSaveModal(true)}
            className="bg-white text-green-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-green-50 transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg shrink-0"
          >
            <Bookmark className="w-4 h-4" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Nutrition Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Calories */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-600">
              {localNutrition.calories}
            </div>
            <div className="text-sm font-medium text-red-700 mt-1">
              Calories
            </div>
          </div>

          {/* Carbs */}
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-yellow-600">
              {localNutrition.carbs}g
            </div>
            <div className="text-sm font-medium text-yellow-700 mt-1">
              Carbs
            </div>
          </div>

          {/* Protein */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">
              {localNutrition.protein}g
            </div>
            <div className="text-sm font-medium text-blue-700 mt-1">
              Protein
            </div>
          </div>

          {/* Fat */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">
              {localNutrition.fat}g
            </div>
            <div className="text-sm font-medium text-purple-700 mt-1">
              Fat
            </div>
          </div>
        </div>

        {/* Fiber - Full Width */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4 text-center mb-4">
          <div className="text-3xl font-bold text-green-600">
            {localNutrition.fiber}g
          </div>
          <div className="text-sm font-medium text-green-700 mt-1">
            Fiber
          </div>
        </div>

        {/* Macronutrient Bar */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Macronutrient Distribution
          </h3>
          <div className="flex rounded-lg overflow-hidden h-4 bg-gray-200">
            {(() => {
              const totalCals = (nutrition.carbs * 4) + (nutrition.protein * 4) + (nutrition.fat * 9);
              const carbsPct = totalCals > 0 ? ((nutrition.carbs * 4) / totalCals) * 100 : 0;
              const proteinPct = totalCals > 0 ? ((nutrition.protein * 4) / totalCals) * 100 : 0;
              const fatPct = totalCals > 0 ? ((nutrition.fat * 9) / totalCals) * 100 : 0;

              return (
                <>
                  <div 
                    className="bg-yellow-400"
                    style={{ width: `${carbsPct}%` }}
                    title={`Carbs: ${carbsPct.toFixed(1)}%`}
                  />
                  <div 
                    className="bg-blue-400"
                    style={{ width: `${proteinPct}%` }}
                    title={`Protein: ${proteinPct.toFixed(1)}%`}
                  />
                  <div 
                    className="bg-purple-400"
                    style={{ width: `${fatPct}%` }}
                    title={`Fat: ${fatPct.toFixed(1)}%`}
                  />
                </>
              );
            })()}
          </div>
          
          {/* Aligned Labels */}
          <div className="relative mt-1">
            {(() => {
              const totalCals = (nutrition.carbs * 4) + (nutrition.protein * 4) + (nutrition.fat * 9);
              const carbsPct = totalCals > 0 ? ((nutrition.carbs * 4) / totalCals) * 100 : 0;
              const proteinPct = totalCals > 0 ? ((nutrition.protein * 4) / totalCals) * 100 : 0;
              const fatPct = totalCals > 0 ? ((nutrition.fat * 9) / totalCals) * 100 : 0;

              // Calculate center positions of each segment
              const carbsCenter = carbsPct / 2;
              const proteinCenter = carbsPct + (proteinPct / 2);
              const fatCenter = carbsPct + proteinPct + (fatPct / 2);

              return (
                <div className="flex relative h-6 text-xs text-gray-600">
                  {/* Carbs Label */}
                  {carbsPct > 0 && (
                    <div 
                      className="absolute flex items-center justify-center transform -translate-x-1/2"
                      style={{ left: `${carbsCenter}%` }}
                    >
                      <span className="w-2 h-2 bg-yellow-400 rounded-full mr-1"></span>
                      <span className="whitespace-nowrap">Carbs</span>
                    </div>
                  )}
                  
                  {/* Protein Label */}
                  {proteinPct > 0 && (
                    <div 
                      className="absolute flex items-center justify-center transform -translate-x-1/2"
                      style={{ left: `${proteinCenter}%` }}
                    >
                      <span className="w-2 h-2 bg-blue-400 rounded-full mr-1"></span>
                      <span className="whitespace-nowrap">Protein</span>
                    </div>
                  )}
                  
                  {/* Fat Label */}
                  {fatPct > 0 && (
                    <div 
                      className="absolute flex items-center justify-center transform -translate-x-1/2"
                      style={{ left: `${fatCenter}%` }}
                    >
                      <span className="w-2 h-2 bg-purple-400 rounded-full mr-1"></span>
                      <span className="whitespace-nowrap">Fat</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Food Breakdown */}
        {localDetailedItems && localDetailedItems.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Food Breakdown</h3>
              {portionAnalysis && portionAnalysis.totalEstimatedWeight > 0 && (
                <div className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-full">
                  Total: ~{Math.round(portionAnalysis.totalEstimatedWeight)}g
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              {localDetailedItems.map((item, index) => (
                <EditableFoodItem
                  key={index}
                  foodItem={item}
                  index={index}
                  onUpdate={handleFoodUpdate}
                  onEditingChange={handleEditingChange}
                  disabled={editingIndex !== null && editingIndex !== index}
                />
              ))}
            </div>
          </div>
        )}

        {/* Portion Analysis Section */}

        {/* Serving Info Details */}
        {servingInfo && servingInfo.weight && (
          <div className="text-xs text-gray-500 mt-6 p-3 bg-gray-50 rounded-lg">
            <strong>Serving Info:</strong> {servingInfo.weight} {servingInfo.unit}
            {servingInfo.description && servingInfo.description !== servingInfo.weight && (
              <span> ({servingInfo.description})</span>
            )}
          </div>
        )}
      </div>

      {/* Save Meal Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 animate-fadeIn" onClick={() => !isSaving && !saveStatus && handleCloseModal()}>
          <div className={`bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto transition-all duration-300 ${isClosing ? 'animate-slideDown' : 'animate-slideUp'}`} onClick={(e) => e.stopPropagation()}>
            
            {/* Success/Error Status Overlay */}
            {saveStatus && (
              <div className="absolute inset-0 bg-white rounded-t-3xl sm:rounded-2xl flex items-center justify-center z-10 animate-fadeIn">
                <div className="text-center p-8">
                  {saveStatus === 'success' ? (
                    <>
                      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Meal Saved!</h3>
                      <p className="text-sm text-green-600 font-medium mb-1">Great job tracking your nutrition!</p>
                      <p className="text-xs text-gray-500">Keep up the healthy habits</p>
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Save Failed</h3>
                      <p className="text-sm text-gray-500 mb-4">Unable to save meal. Please try again.</p>
                      <button
                        onClick={() => setSaveStatus(null)}
                        className="bg-red-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                      >
                        Try Again
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Modal Content */}
            <div className="p-4">
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bookmark className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-base mb-0.5">Save This Meal?</h3>
                  <p className="text-xs text-gray-500">Review your meal summary before saving</p>
                </div>
                <button
                  onClick={handleCloseModal}
                  disabled={isSaving || saveStatus === 'success'}
                  className="p-1 hover:bg-gray-50 rounded-md transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Close"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Nutrition Summary */}
              <div className="bg-white rounded-lg overflow-hidden border border-gray-100 mb-3">
                <div className="py-2 px-3 border-b border-gray-100">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium text-gray-900 text-sm">Nutrition Summary</h4>
                    <span className="text-sm bg-green-100 text-green-600 px-2 py-0.5 rounded font-medium">{localNutrition.calories} kcal</span>
                  </div>
                </div>

                {/* Food Items */}
                {localDetailedItems.length > 0 && (
                  <div className="p-3 bg-gray-50">
                    <h5 className="text-xs font-semibold text-gray-500 mb-2 tracking-wide">FOOD ITEMS</h5>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {localDetailedItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-gray-200 rounded flex items-center justify-center text-xs font-medium text-gray-600">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{item.name}</p>
                              <p className="text-[11px] text-gray-500">
                                {item.serving?.description || item.portionDescription || item.portion || '1 serving'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-800">{item.nutrition?.calories || item.calories} kcal</p>
                            <p className="text-[11px] text-gray-500">
                              <span className="text-blue-600">{item.nutrition?.protein || item.protein}P</span> • 
                              <span className="text-orange-600"> {item.nutrition?.carbs || item.carbs}C</span> • 
                              <span className="text-yellow-600"> {item.nutrition?.fat || item.fat}F</span> • 
                              <span className="text-green-600"> {item.nutrition?.fiber || item.fiber}Fb</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Macro Grid */}
                <div className="grid grid-cols-4 gap-px bg-gray-100">
                  <div className="bg-white p-2 text-center">
                    <p className="text-xs text-blue-500">Protein</p>
                    <p className="font-medium text-sm">{localNutrition.protein}g</p>
                  </div>
                  <div className="bg-white p-2 text-center">
                    <p className="text-xs text-orange-500">Carbs</p>
                    <p className="font-medium text-sm">{localNutrition.carbs}g</p>
                  </div>
                  <div className="bg-white p-2 text-center">
                    <p className="text-xs text-yellow-500">Fat</p>
                    <p className="font-medium text-sm">{localNutrition.fat}g</p>
                  </div>
                  <div className="bg-white p-2 text-center">
                    <p className="text-xs text-green-500">Fiber</p>
                    <p className="font-medium text-sm">{localNutrition.fiber}g</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleCloseModal}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSaving || saveStatus === 'success'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMeal}
                  disabled={isSaving || saveStatus === 'success'}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                    isSaving || saveStatus === 'success'
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Meal</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NutritionCard;