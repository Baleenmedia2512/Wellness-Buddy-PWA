import React from 'react';
import { Sun } from 'lucide-react';
import MicroNutrientTile from './MicroNutrientTile';

/**
 * VitaminsFatSolubleCard — Card 6 of the Nutrition Carousel.
 * Vitamins A, C, D, E, K. Five tiles in a 3-col grid (last cell blank).
 */
const VitaminsFatSolubleCard = ({ tiles }) => {
  return (
    <div className="h-full flex items-start justify-center pt-1 px-2">
      <div className="bg-white rounded-xl shadow-lg p-2.5 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
              <Sun className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Vitamins A–K</span>
          </div>
        </div>

        {/* 5 tiles in 3-col × 2-row grid */}
        <div className="grid grid-cols-3 gap-y-1.5 gap-x-2">
          {tiles.map((t) => (
            <MicroNutrientTile
              key={t.key}
              label={t.label}
              unit={t.unit}
              consumed={t.consumed}
              target={t.target}
              pct={t.pct}
              color="from-amber-400 to-orange-500"
            />
          ))}
        </div>

        <p className="text-[10px] text-gray-400 text-center mt-1.5 pt-1.5 border-t border-gray-100">
          Daily recommended intake (adult)
        </p>
      </div>
    </div>
  );
};

export default VitaminsFatSolubleCard;
