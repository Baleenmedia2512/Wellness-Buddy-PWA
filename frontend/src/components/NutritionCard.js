//src\components\NutritionCard.js
import React from 'react';

// ✅ ANDROID OPTIMIZATION: Memoize component to prevent unnecessary re-renders
const NutritionCard = React.memo(({ data }) => {
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
              {nutrition.calories}
            </div>
            <div className="text-sm font-medium text-red-700">
              Calories
            </div>
          </div>

          {/* Carbs */}
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {nutrition.carbs}g
            </div>
            <div className="text-sm font-medium text-yellow-700">
              Carbs
            </div>
          </div>

          {/* Protein */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {nutrition.protein}g
            </div>
            <div className="text-sm font-medium text-blue-700">
              Protein
            </div>
          </div>

          {/* Fat */}
          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {nutrition.fat}g
            </div>
            <div className="text-sm font-medium text-purple-700">
              Fat
            </div>
          </div>

          {/* Fiber */}
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-center col-span-2 md:col-span-1">
            <div className="text-2xl font-bold text-green-600">
              {nutrition.fiber}g
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
        {detailedItems && detailedItems.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Food Breakdown</h3>
              {portionAnalysis && portionAnalysis.totalEstimatedWeight > 0 && (
                <div className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-full">
                  Total: ~{Math.round(portionAnalysis.totalEstimatedWeight)}g
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              {detailedItems.map((item, index) => (
                <div key={index} className="group hover:bg-gray-50 transition-colors duration-200 rounded-xl p-4 border border-gray-100">
                  {/* Food Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-base">{item.name}</h4>
                      <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-600">
                        {item.portionDescription && item.portionDescription !== 'Unknown portion' && (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                            {item.portionDescription}
                          </span>
                        )}
                        {item.estimatedWeight && item.estimatedWeight !== 'Unknown' && (
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                            ~{item.estimatedWeight}g
                          </span>
                        )}
                      </div>
                    </div>
                    {item.confidence && (
                      <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
                        item.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                        item.confidence === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {item.confidence}
                      </span>
                    )}
                  </div>
                  
                  {/* Nutrition Grid */}
                  <div className="grid grid-cols-5 gap-3">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-red-600">{item.calories}</div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-yellow-600">{item.carbs}g</div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Carbs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-600">{item.protein}g</div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Protein</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-purple-600">{item.fat}g</div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Fat</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-600">{item.fiber}g</div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Fiber</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
});

// Add display name for debugging
NutritionCard.displayName = 'NutritionCard';

export default NutritionCard;