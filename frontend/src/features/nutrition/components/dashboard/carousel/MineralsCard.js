import React from 'react';
import { Gem } from 'lucide-react';
import MicroNutrientTile from './MicroNutrientTile';

/**
 * MineralsCard — Card 8 of the Nutrition Carousel.
 * Calcium, Iron, Magnesium, Potassium, Zinc, Phosphorus. 3-col × 2-row grid.
 */
const MineralsCard = ({ tiles }) => {
  return (
    <div className="h-full flex items-center justify-center py-2">
      <div className="bg-white rounded-xl shadow-lg p-2.5 w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center shadow-md">
              <Gem className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Minerals</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-y-1.5 gap-x-2">
          {tiles.map((t) => (
            <MicroNutrientTile
              key={t.key}
              label={t.label}
              unit={t.unit}
              consumed={t.consumed}
              target={t.target}
              pct={t.pct}
              color="from-teal-400 to-emerald-600"
            />
          ))}
        </div>

        <p className="text-[10px] text-gray-400 text-center mt-1.5 pt-1.5 border-t border-gray-100">
          Essential minerals (adult RDA)
        </p>
      </div>
    </div>
  );
};

export default MineralsCard;
