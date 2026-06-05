import React from 'react';
import { Beef, Droplet, Wheat } from 'lucide-react';
import CircularProgress from './CircularProgress';

/**
 * MacrosCard — Card 2 of the Nutrition Carousel.
 * Compact MyFitnessPal-style with 3 macros side by side.
 */
const MacrosCard = ({ consumedProtein, consumedFat, consumedCarbs, proteinTarget, fatTarget, carbsTarget, glycemicIndex }) => {
  const hasTargets = proteinTarget != null;

  const giLabel = glycemicIndex == null ? null
    : glycemicIndex <= 55 ? 'Low'
    : glycemicIndex <= 69 ? 'Medium'
    : 'High';
  const giColors = glycemicIndex == null ? null
    : glycemicIndex <= 55 ? 'bg-green-100 text-green-700'
    : glycemicIndex <= 69 ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700';
  
  const proteinPct = hasTargets && proteinTarget > 0 ? Math.round((consumedProtein / proteinTarget) * 100) : null;
  const fatPct = hasTargets && fatTarget > 0 ? Math.round((consumedFat / fatTarget) * 100) : null;
  const carbsPct = hasTargets && carbsTarget > 0 ? Math.round((consumedCarbs / carbsTarget) * 100) : null;

  return (
    <div className="h-full flex items-start justify-center pt-1 px-2">
      <div className="bg-white rounded-xl shadow-lg p-3 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-md">
              <Beef className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-base font-bold text-gray-900">Macros</span>
          </div>
          {!hasTargets && (
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              Log weight
            </span>
          )}
        </div>

        {/* 3 Macros in a Row — order: Carbs, Fat, Protein */}
        <div className="grid grid-cols-3 gap-3">
          {/* Carbs */}
          <div className="text-center">
            {carbsPct != null ? (
              <CircularProgress percentage={carbsPct} color="from-orange-400 to-amber-400" size={60} strokeWidth={5} targetLabel={carbsTarget != null ? `${carbsTarget}g` : undefined} />
            ) : (
              <div className="w-[60px] h-[60px] mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-xs text-gray-400 font-medium">?</span>
              </div>
            )}
            <div className="mt-1">
              <div className="flex items-center justify-center gap-0.5 mb-0.5">
                <Wheat className="w-3 h-3 text-orange-500" />
                <p className="text-[10px] font-semibold text-gray-700">Carbs</p>
              </div>
              <p className="text-xs font-bold text-gray-900">{Math.round(consumedCarbs || 0)}g</p>
              {hasTargets && <p className="text-[9px] text-gray-500">/ {carbsTarget}g</p>}
              {!hasTargets && <p className="text-[8px] text-amber-600">No target</p>}
            </div>
          </div>

          {/* Fat */}
          <div className="text-center">
            {fatPct != null ? (
              <CircularProgress percentage={fatPct} color="from-yellow-400 to-amber-500" size={60} strokeWidth={5} targetLabel={fatTarget != null ? `${fatTarget}g` : undefined} />
            ) : (
              <div className="w-[60px] h-[60px] mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-xs text-gray-400 font-medium">?</span>
              </div>
            )}
            <div className="mt-1">
              <div className="flex items-center justify-center gap-0.5 mb-0.5">
                <Droplet className="w-3 h-3 text-yellow-500" />
                <p className="text-[10px] font-semibold text-gray-700">Fat</p>
              </div>
              <p className="text-xs font-bold text-gray-900">{Math.round(consumedFat || 0)}g</p>
              {hasTargets && <p className="text-[9px] text-gray-500">/ {fatTarget}g</p>}
              {!hasTargets && <p className="text-[8px] text-amber-600">No target</p>}
            </div>
          </div>

          {/* Protein */}
          <div className="text-center">
            {proteinPct != null ? (
              <CircularProgress percentage={proteinPct} color="from-blue-400 to-indigo-500" size={60} strokeWidth={5} targetLabel={proteinTarget != null ? `${proteinTarget}g` : undefined} />
            ) : (
              <div className="w-[60px] h-[60px] mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-xs text-gray-400 font-medium">?</span>
              </div>
            )}
            <div className="mt-1">
              <div className="flex items-center justify-center gap-0.5 mb-0.5">
                <Beef className="w-3 h-3 text-blue-500" />
                <p className="text-[10px] font-semibold text-gray-700">Protein</p>
              </div>
              <p className="text-xs font-bold text-gray-900">{Math.round(consumedProtein || 0)}g</p>
              {hasTargets && <p className="text-[9px] text-gray-500">/ {proteinTarget}g</p>}
              {!hasTargets && <p className="text-[8px] text-amber-600">No target</p>}
            </div>
          </div>
        </div>

        {/* Footer */}
        {hasTargets && (
          <p className="text-[9px] text-gray-400 text-center mt-1.5 pt-1.5 border-t border-gray-100">
            Targets based on your weight
          </p>
        )}

        {/* Glycemic Index row */}
        {glycemicIndex != null && (
          <div className={`flex items-center justify-between mt-1.5 pt-1.5 ${hasTargets ? '' : 'border-t border-gray-100'}` }>
            <span className="text-[9px] text-gray-500">Avg. Glycemic Index</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${giColors}`}>
              {glycemicIndex} · {giLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MacrosCard;
