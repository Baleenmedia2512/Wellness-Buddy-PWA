import React from 'react';
import CircularProgress from './CircularProgress';

/**
 * MicroNutrientTile — one cell in a 3×2 grid of vitamins/minerals.
 *
 * Compact variant of HeartHealthyCard's tile: 44px ring + label/value below.
 * Keeps card height within the carousel's min-h-[148px] budget.
 *
 * Props are shaped by computeMicronutrientTile() in
 *   features/nutrition/domain/micronutrientRules.js
 *
 * Reuse criteria (claude.md §2.4): used in 3 cards (Vit fat-soluble,
 * Vit B-Complex, Minerals) → shared component.
 */
const MicroNutrientTile = ({ label, unit, consumed, target, pct, color }) => {
  return (
    <div className="text-center">
      <CircularProgress
        percentage={pct}
        color={color}
        size={44}
        strokeWidth={4}
      />
      <p className="text-[10px] font-semibold text-gray-700 mt-0.5 leading-tight">
        {label}
      </p>
      <p className="text-[10px] font-bold text-gray-900 leading-tight">
        {consumed}
        <span className="text-[9px] font-normal text-gray-500">/{target}{unit}</span>
      </p>
    </div>
  );
};

export default MicroNutrientTile;
