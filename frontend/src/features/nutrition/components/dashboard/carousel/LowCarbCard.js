import React from 'react';
import { Wheat, Candy, Leaf } from 'lucide-react';

const NutrientRow = ({ icon: Icon, iconColor, label, consumed, target, unit, accent }) => {
  const pct = Math.min(100, Math.round((consumed / (target || 1)) * 100));
  const isOver = target != null && consumed > target;
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
          <span className="text-[11px] font-medium text-gray-600">{label}</span>
        </div>
        <span className="text-[11px] text-gray-500">
          {consumed.toLocaleString()}{unit}
          {target != null && <> / {target.toLocaleString()}{unit}</>}
          {isOver && <span className="ml-1 text-rose-600 font-semibold">↑</span>}
        </span>
      </div>
      {target != null ? (
        <div className="w-full bg-gray-200/70 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${isOver ? 'bg-rose-400' : accent}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <div className="text-[9px] text-amber-600">Log weight to see carbs target</div>
      )}
    </div>
  );
};

/**
 * LowCarbCard — Card 4 of the Nutrition Carousel.
 * Tracks Carbs (weight-derived target), Sugar (≤50g), Fiber (≥25g goal).
 */
const LowCarbCard = ({ carbs, sugar, fiber }) => {
  const fiberPct = Math.min(100, Math.round(((fiber.consumed || 0) / fiber.target) * 100));
  return (
    <div className="h-full flex flex-col justify-between px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Wheat className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-700">Low Carb</span>
        </div>
        <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">Carb goals</span>
      </div>

      <NutrientRow
        icon={Wheat}
        iconColor="text-orange-500"
        label="Carbs"
        consumed={carbs.consumed}
        target={carbs.target}
        unit="g"
        accent="bg-gradient-to-r from-orange-400 to-amber-400"
      />

      <NutrientRow
        icon={Candy}
        iconColor="text-pink-500"
        label="Sugar"
        consumed={sugar.consumed}
        target={sugar.target}
        unit="g"
        accent="bg-gradient-to-r from-pink-400 to-rose-400"
      />

      {/* Fiber — displayed as an achievement (reach the target, not limit it) */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <Leaf className="w-3.5 h-3.5 text-green-600" />
            <span className="text-[11px] font-medium text-gray-600">Fiber</span>
          </div>
          <span className="text-[11px] text-gray-500">
            {fiber.consumed}g / {fiber.target}g
            {fiber.consumed >= fiber.target && <span className="ml-1 text-emerald-600">✓</span>}
          </span>
        </div>
        <div className="w-full bg-gray-200/70 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-1.5 rounded-full transition-all duration-500 bg-gradient-to-r from-green-400 to-emerald-500"
            style={{ width: `${fiberPct}%` }}
          />
        </div>
      </div>

      <p className="text-[9px] text-gray-400 mt-1">
        Sugar & fiber values available when AI detects them in meals.
      </p>
    </div>
  );
};

export default LowCarbCard;
