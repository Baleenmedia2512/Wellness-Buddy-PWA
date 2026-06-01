import React from 'react';
import { Beef, Droplet, Wheat } from 'lucide-react';

const MacroRow = ({ icon: Icon, color, label, consumed, target }) => {
  const pct = target != null && target > 0
    ? Math.min(100, Math.round((consumed / target) * 100))
    : null;
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <Icon className={`w-3.5 h-3.5 ${color}`} />
          <span className="text-[11px] font-medium text-gray-600">{label}</span>
        </div>
        <span className="text-[11px] text-gray-500">
          {consumed}g {target != null ? `/ ${target}g` : ''}
          {pct != null && <span className={`ml-1 font-semibold ${pct >= 100 ? 'text-rose-600' : 'text-gray-700'}`}>({pct}%)</span>}
        </span>
      </div>
      {pct != null ? (
        <div className="w-full bg-gray-200/70 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-rose-400' : 'bg-gradient-to-r from-blue-400 to-indigo-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div className="text-[9px] text-gray-400 pl-1">Set weight to see target</div>
        </div>
      )}
    </div>
  );
};

/**
 * MacrosCard — Card 2 of the Nutrition Carousel.
 * Shows Protein, Fat, Carbs with body-weight-derived targets.
 * When latestWeight is unavailable targets are null and progress is hidden.
 */
const MacrosCard = ({ consumedProtein, consumedFat, consumedCarbs, proteinTarget, fatTarget, carbsTarget }) => {
  const hasTargets = proteinTarget != null;
  return (
    <div className="h-full flex flex-col justify-between px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Beef className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-700">Macros</span>
        </div>
        {!hasTargets && (
          <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            Log weight for targets
          </span>
        )}
      </div>

      {/* Macro rows */}
      <div className="flex-1">
        <MacroRow
          icon={Beef}
          color="text-blue-500"
          label="Protein"
          consumed={Math.round(consumedProtein || 0)}
          target={proteinTarget}
        />
        <MacroRow
          icon={Droplet}
          color="text-yellow-500"
          label="Fat"
          consumed={Math.round(consumedFat || 0)}
          target={fatTarget}
        />
        <MacroRow
          icon={Wheat}
          color="text-orange-500"
          label="Carbs"
          consumed={Math.round(consumedCarbs || 0)}
          target={carbsTarget}
        />
      </div>

      {hasTargets && (
        <p className="text-[10px] text-gray-400 text-center mt-1">
          Targets based on your logged weight
        </p>
      )}
    </div>
  );
};

export default MacrosCard;
