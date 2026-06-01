import React from 'react';
import { Heart, Droplet, Activity } from 'lucide-react';

const NutrientRow = ({ icon: Icon, iconColor, label, consumed, target, unit, accent }) => {
  const pct = Math.min(100, Math.round((consumed / target) * 100));
  const isOver = consumed > target;
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
          <span className="text-[11px] font-medium text-gray-600">{label}</span>
        </div>
        <span className="text-[11px] text-gray-500">
          {consumed.toLocaleString()}{unit} / {target.toLocaleString()}{unit}
          {isOver && <span className="ml-1 text-rose-600 font-semibold">↑</span>}
        </span>
      </div>
      <div className="w-full bg-gray-200/70 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${isOver ? 'bg-rose-400' : accent}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

/**
 * HeartHealthyCard — Card 3 of the Nutrition Carousel.
 * Tracks Fat (macro target), Sodium (≤2300mg), Cholesterol (≤300mg).
 * When fat target is null (no weight logged), shows consumed-only for Fat.
 */
const HeartHealthyCard = ({ fat, sodium, cholesterol }) => {
  const hasFatTarget = fat.target != null;
  return (
    <div className="h-full flex flex-col justify-between px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Heart className="w-4 h-4 text-rose-500" />
          <span className="text-sm font-semibold text-gray-700">Heart Healthy</span>
        </div>
        <span className="text-[10px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">Daily limits</span>
      </div>

      {/* Fat */}
      {hasFatTarget ? (
        <NutrientRow
          icon={Droplet}
          iconColor="text-yellow-500"
          label="Fat"
          consumed={fat.consumed}
          target={fat.target}
          unit="g"
          accent="bg-gradient-to-r from-yellow-400 to-amber-500"
        />
      ) : (
        <div className="mb-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Droplet className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-[11px] font-medium text-gray-600">Fat</span>
            </div>
            <span className="text-[11px] text-gray-500">{fat.consumed}g <span className="text-amber-600">(log weight for target)</span></span>
          </div>
        </div>
      )}

      <NutrientRow
        icon={Activity}
        iconColor="text-rose-500"
        label="Sodium"
        consumed={sodium.consumed}
        target={sodium.target}
        unit="mg"
        accent="bg-gradient-to-r from-rose-400 to-pink-500"
      />

      <NutrientRow
        icon={Heart}
        iconColor="text-purple-500"
        label="Cholesterol"
        consumed={cholesterol.consumed}
        target={cholesterol.target}
        unit="mg"
        accent="bg-gradient-to-r from-purple-400 to-violet-500"
      />

      <p className="text-[9px] text-gray-400 mt-1">
        Sodium & cholesterol values available when AI detects them in meals.
      </p>
    </div>
  );
};

export default HeartHealthyCard;
