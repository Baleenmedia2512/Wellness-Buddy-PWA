//src\components\NutritionCard.js
import React, { useState } from 'react';
import EditableFoodItem from './EditableFoodItem';

const NutritionCard = ({ data, onDataUpdate }) => {
  // Local state for editable food items (must be before early return)
  const [localDetailedItems, setLocalDetailedItems] = useState(data?.detailedItems || []);
  const [localNutrition, setLocalNutrition] = useState(data?.nutrition || {});

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
    
    // Notify parent if callback provided
    if (onDataUpdate) {
      onDataUpdate({
        ...data,
        detailedItems: newItems,
        nutrition: newTotals
      });
    }
  };

  // Early return after hooks
  if (!data) return null;

  const { nutrition, category, servingInfo, itemCount, detailedItems, portionAnalysis } = data;

  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-green-300 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4">
        <h2 className="text-xl font-bold text-center">
          {category.name}
        </h2>
        {itemCount && itemCount > 1 && (
          <p className="text-center text-green-100 text-sm mt-1">
            {itemCount} food items analyzed
          </p>
        )}
        {servingInfo && (
          <p className="text-center text-green-100 text-sm">
            Per {servingInfo.description || '100g'}
          </p>
        )}
      </div>

      {/* Nutrition Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
          {/* Calories */}
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {localNutrition.calories}
            </div>
            <div className="text-sm font-medium text-red-700">
              Calories
            </div>
          </div>

          {/* Carbs */}
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {localNutrition.carbs}g
            </div>
            <div className="text-sm font-medium text-yellow-700">
              Carbs
            </div>
          </div>

          {/* Protein */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {localNutrition.protein}g
            </div>
            <div className="text-sm font-medium text-blue-700">
              Protein
            </div>
          </div>

          {/* Fat */}
          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {localNutrition.fat}g
            </div>
            <div className="text-sm font-medium text-purple-700">
              Fat
            </div>
          </div>

          {/* Fiber */}
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-center col-span-2 md:col-span-1">
            <div className="text-2xl font-bold text-green-600">
              {localNutrition.fiber}g
            </div>
            <div className="text-sm font-medium text-green-700">
              Fiber
            </div>
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

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3">
          <button 
            onClick={() => {
              // Enhanced copy with portion information
              let copyText = `${category.name}: ${nutrition.calories} calories, ${nutrition.carbs}g carbs, ${nutrition.protein}g protein, ${nutrition.fat}g fat, ${nutrition.fiber}g fiber`;
              
              if (portionAnalysis?.totalEstimatedWeight > 0) {
                copyText += `\nTotal Weight: ~${Math.round(portionAnalysis.totalEstimatedWeight)}g`;
              }
              
              if (detailedItems && detailedItems.length > 1) {
                copyText += '\n\nBreakdown:';
                detailedItems.forEach(item => {
                  copyText += `\n• ${item.name}`;
                  if (item.portionDescription && item.portionDescription !== 'Unknown portion') {
                    copyText += ` (${item.portionDescription})`;
                  }
                  copyText += `: ${item.calories} cal`;
                });
              }
              
              navigator.clipboard?.writeText(copyText);
            }}
            className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <span>📋</span>
            Copy Info
          </button>
          
          <button 
            onClick={() => window.location.reload()}
            className="flex-1 bg-green-100 text-green-700 py-3 px-4 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <span>🔍</span>
            Search Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default NutritionCard;