//src\components\NutritionCard.js
import React, { useState, useCallback } from 'react';
import EditableFoodItem from './EditableFoodItem';
import { getUserId } from '../services/getUserId';

const NutritionCard = ({ data, onDataUpdate, user, imagePreview, selectedImage, savedMealId, onClose }) => {
  // Local state for editable food items (must be before early return)
  const [localDetailedItems, setLocalDetailedItems] = useState(data?.detailedItems || []);
  const [localNutrition, setLocalNutrition] = useState(data?.nutrition || {});
  const [isSaving, setIsSaving] = useState(false);
  const [editingStates, setEditingStates] = useState({});

  // Handle editing state change from EditableFoodItem - wrapped in useCallback to prevent re-creation
  const handleEditingChange = useCallback((index, isItemEditing, isBlocking = false) => {
    setEditingStates(prev => ({
      ...prev,
      [index]: isItemEditing
    }));
    
    // Track if any item is actively saving/retrying (blocks actions)
    setIsSaving(isBlocking);
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

  // Handle food item update with auto-save
  const handleFoodUpdate = async (index, updatedFood) => {
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
    
    // Phase 5: Auto-save update to backend
    if (!savedMealId) {
      console.warn('⚠️ [NutritionCard] No saved meal ID - skipping auto-save');
      return;
    }
    
    try {
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';
      
      // Get userId - either from user object directly or via lookup
      let userId = user?.id;
      if (!userId) {
        userId = await getUserId(user);
      }
      
      if (!userId) {
        throw new Error('User not authenticated or not found in database');
      }
      
      // Prepare analysis data
      const analysisData = {
        foods: newItems.map(item => ({
          name: item.name,
          // 🔴 CRITICAL: Preserve correction metadata for database persistence
          originalAiName: item.originalAiName || item.name,
          wasAutoCorrected: item.wasAutoCorrected || false,
          correctionSource: item.correctionSource || null,
          correctionMetadata: item.correctionMetadata || null,
          portion: item.serving?.description || item.portionDescription || item.portion || '1 serving',
          weight_g: item.serving?.grams || item.grams || item.weight_g || 100,
          volume_ml: item.volume_ml || null,
          unit: item.unit || 'g',
          isLiquid: item.isLiquid || false,
          nutrition: {
            calories: Math.round(item.nutrition?.calories || item.calories || 0),
            protein: Math.round(item.nutrition?.protein || item.protein || 0),
            carbs: Math.round(item.nutrition?.carbs || item.carbs || 0),
            fat: Math.round(item.nutrition?.fat || item.fat || 0),
            fiber: Math.round(item.nutrition?.fiber || item.fiber || 0)
          }
        })),
        total: {
          calories: Math.round(newTotals.calories || 0),
          protein: Math.round(newTotals.protein || 0),
          carbs: Math.round(newTotals.carbs || 0),
          fat: Math.round(newTotals.fat || 0),
          fiber: Math.round(newTotals.fiber || 0)
        },
        confidence: 'high'
      };
      
      // Update existing meal
      console.log('📝 [NutritionCard] Auto-saving update to meal ID:', savedMealId);
      
      const response = await fetch(`${apiBaseUrl}/api/update-nutrition-analysis`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: savedMealId,
          userId: userId,
          analysisData: analysisData,
          totalCalories: Math.round(newTotals.calories || 0),
          totalProtein: Math.round(newTotals.protein || 0),
          totalCarbs: Math.round(newTotals.carbs || 0),
          totalFat: Math.round(newTotals.fat || 0),
          totalFiber: Math.round(newTotals.fiber || 0)
        })
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update meal');
      }
      
      console.log('✅ [NutritionCard] Auto-save update successful');
    } catch (error) {
      console.error('❌ [NutritionCard] Auto-save failed:', error);
      // Phase 5: Re-throw error so EditableFoodItem's retry logic can handle it
      throw error;
    }
  };

  // Early return after hooks
  if (!data) return null;

  const { nutrition, category, servingInfo, itemCount, detailedItems, portionAnalysis } = data;

  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-green-300 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4">
        <div className="flex items-center justify-center gap-3">
          <div className="flex-1 text-center">
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
                  user={user}
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
    </div>
  );
};

// Add display name for debugging
NutritionCard.displayName = 'NutritionCard';

export default NutritionCard;