import React from 'react';
import { Wheat, Candy, Leaf } from 'lucide-react';
import CircularProgress from './CircularProgress';

/**
 * LowCarbCard — Card 4 of the Nutrition Carousel.
 * Compact MyFitnessPal-style with 3 nutrients side by side.
 */
const LowCarbCard = ({ carbs, sugar, fiber }) => {
  const carbsPct = carbs.target != null ? Math.round((carbs.consumed / carbs.target) * 100) : null;
  const sugarPct = Math.round((sugar.consumed / sugar.target) * 100);
  const fiberPct = Math.round(((fiber.consumed || 0) / fiber.target) * 100);

  return (
    <div className="h-full flex items-start justify-center pt-1 px-2">
      <div className="bg-white rounded-xl shadow-lg p-2.5 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-md">
              <Wheat className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Low Carb</span>
          </div>
        </div>

        {/* 3 Nutrients in a Row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Carbs */}
          <div className="text-center">
            {carbsPct != null ? (
              <CircularProgress percentage={carbsPct} color="from-orange-400 to-amber-400" size={70} strokeWidth={6} targetLabel={carbs.target != null ? `${carbs.target}g` : undefined} />
            ) : (
              <div className="w-[70px] h-[70px] mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                <Wheat className="w-5 h-5 text-gray-400" />
              </div>
            )}
            <div className="mt-1.5">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Wheat className="w-3.5 h-3.5 text-orange-500" />
                <p className="text-xs font-semibold text-gray-700">Carbs</p>
              </div>
              <p className="text-sm font-bold text-gray-900">{carbs.consumed}g</p>
              {carbs.target != null && <p className="text-[10px] text-gray-500">/ {carbs.target}g</p>}
              {carbs.target == null && <p className="text-[9px] text-amber-600">Log weight</p>}
            </div>
          </div>

          {/* Sugar */}
          <div className="text-center">
            <CircularProgress percentage={sugarPct} color="from-pink-400 to-rose-400" size={70} strokeWidth={6} targetLabel={`${sugar.target}g`} />
            <div className="mt-1.5">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Candy className="w-3.5 h-3.5 text-pink-500" />
                <p className="text-xs font-semibold text-gray-700">Sugar</p>
              </div>
              <p className="text-sm font-bold text-gray-900">{sugar.consumed}g</p>
              <p className="text-[10px] text-gray-500">/ {sugar.target}g</p>
            </div>
          </div>

          {/* Fiber (goal, not limit) */}
          <div className="text-center">
            <CircularProgress percentage={fiberPct} color="from-green-400 to-emerald-500" size={70} strokeWidth={6} targetLabel={`${fiber.target}g`} />
            <div className="mt-1.5">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Leaf className="w-3.5 h-3.5 text-green-600" />
                <p className="text-xs font-semibold text-gray-700">Fiber</p>
              </div>
              <p className="text-sm font-bold text-gray-900">{fiber.consumed}g</p>
              <p className="text-[10px] text-gray-500">/ {fiber.target}g</p>
              {fiber.consumed >= fiber.target && (
                <p className="text-[9px] text-emerald-600 font-semibold">Goal! ✓</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-gray-400 text-center mt-2 pt-2 border-t border-gray-100">
          Track your carb intake goals
        </p>
      </div>
    </div>
  );
};

export default LowCarbCard;
