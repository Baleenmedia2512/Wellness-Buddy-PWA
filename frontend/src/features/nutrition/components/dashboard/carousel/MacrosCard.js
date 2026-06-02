import React from 'react';
import { Beef, Droplet, Wheat } from 'lucide-react';
import CircularProgress from './CircularProgress';

/**
 * MacrosCard — Card 2 of the Nutrition Carousel.
 * Compact MyFitnessPal-style with 3 macros side by side.
 */
const MacrosCard = ({ consumedProtein, consumedFat, consumedCarbs, proteinTarget, fatTarget, carbsTarget }) => {
  const hasTargets = proteinTarget != null;
  
  const proteinPct = hasTargets && proteinTarget > 0 ? Math.min(100, Math.round((consumedProtein / proteinTarget) * 100)) : null;
  const fatPct = hasTargets && fatTarget > 0 ? Math.min(100, Math.round((consumedFat / fatTarget) * 100)) : null;
  const carbsPct = hasTargets && carbsTarget > 0 ? Math.min(100, Math.round((consumedCarbs / carbsTarget) * 100)) : null;

  return (
    <div className="h-full flex items-start justify-center pt-4 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-5 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-md">
              <Beef className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Macros</span>
          </div>
          {!hasTargets && (
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
              Log weight
            </span>
          )}
        </div>

        {/* 3 Macros in a Row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Protein */}
          <div className="text-center">
            {proteinPct != null ? (
              <CircularProgress percentage={proteinPct} color="from-blue-400 to-indigo-500" size={70} strokeWidth={6} />
            ) : (
              <div className="w-[70px] h-[70px] mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-sm text-gray-400 font-medium">?</span>
              </div>
            )}
            <div className="mt-3">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Beef className="w-3.5 h-3.5 text-blue-500" />
                <p className="text-xs font-semibold text-gray-700">Protein</p>
              </div>
              <p className="text-sm font-bold text-gray-900">{Math.round(consumedProtein || 0)}g</p>
              {hasTargets && <p className="text-[10px] text-gray-500">/ {proteinTarget}g</p>}
              {!hasTargets && <p className="text-[9px] text-amber-600">No target</p>}
            </div>
          </div>

          {/* Fat */}
          <div className="text-center">
            {fatPct != null ? (
              <CircularProgress percentage={fatPct} color="from-yellow-400 to-amber-500" size={70} strokeWidth={6} />
            ) : (
              <div className="w-[70px] h-[70px] mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-sm text-gray-400 font-medium">?</span>
              </div>
            )}
            <div className="mt-3">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Droplet className="w-3.5 h-3.5 text-yellow-500" />
                <p className="text-xs font-semibold text-gray-700">Fat</p>
              </div>
              <p className="text-sm font-bold text-gray-900">{Math.round(consumedFat || 0)}g</p>
              {hasTargets && <p className="text-[10px] text-gray-500">/ {fatTarget}g</p>}
              {!hasTargets && <p className="text-[9px] text-amber-600">No target</p>}
            </div>
          </div>

          {/* Carbs */}
          <div className="text-center">
            {carbsPct != null ? (
              <CircularProgress percentage={carbsPct} color="from-orange-400 to-amber-400" size={70} strokeWidth={6} />
            ) : (
              <div className="w-[70px] h-[70px] mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-sm text-gray-400 font-medium">?</span>
              </div>
            )}
            <div className="mt-3">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Wheat className="w-3.5 h-3.5 text-orange-500" />
                <p className="text-xs font-semibold text-gray-700">Carbs</p>
              </div>
              <p className="text-sm font-bold text-gray-900">{Math.round(consumedCarbs || 0)}g</p>
              {hasTargets && <p className="text-[10px] text-gray-500">/ {carbsTarget}g</p>}
              {!hasTargets && <p className="text-[9px] text-amber-600">No target</p>}
            </div>
          </div>
        </div>

        {/* Footer */}
        {hasTargets && (
          <p className="text-[10px] text-gray-400 text-center mt-4 pt-3 border-t border-gray-100">
            Targets based on your weight
          </p>
        )}
      </div>
    </div>
  );
};

export default MacrosCard;
