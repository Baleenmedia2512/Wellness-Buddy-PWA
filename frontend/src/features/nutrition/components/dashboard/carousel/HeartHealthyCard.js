import React from 'react';
import { Heart, Droplet, Activity } from 'lucide-react';
import CircularProgress from './CircularProgress';

/**
 * HeartHealthyCard — Card 3 of the Nutrition Carousel.
 * Compact MyFitnessPal-style with 3 nutrients side by side.
 */
const HeartHealthyCard = ({ fat, sodium, cholesterol }) => {
  const hasFatTarget = fat.target != null;
  
  const fatPct = hasFatTarget ? Math.min(100, Math.round((fat.consumed / fat.target) * 100)) : null;
  const sodiumPct = Math.min(100, Math.round((sodium.consumed / sodium.target) * 100));
  const cholesterolPct = Math.min(100, Math.round((cholesterol.consumed / cholesterol.target) * 100));

  return (
    <div className="h-full flex items-start justify-center pt-4 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-5 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-md">
              <Heart className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Heart Healthy</span>
          </div>
          <span className="text-xs font-semibold bg-rose-50 text-rose-600 px-2.5 py-1 rounded-full">Limits</span>
        </div>

        {/* 3 Nutrients in a Row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Fat */}
          <div className="text-center">
            {hasFatTarget ? (
              <CircularProgress percentage={fatPct} color="from-yellow-400 to-amber-500" size={70} strokeWidth={6} />
            ) : (
              <div className="w-[70px] h-[70px] mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                <Droplet className="w-5 h-5 text-gray-400" />
              </div>
            )}
            <div className="mt-3">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Droplet className="w-3.5 h-3.5 text-yellow-500" />
                <p className="text-xs font-semibold text-gray-700">Fat</p>
              </div>
              <p className="text-sm font-bold text-gray-900">{fat.consumed}g</p>
              {hasFatTarget && <p className="text-[10px] text-gray-500">/ {fat.target}g</p>}
              {!hasFatTarget && <p className="text-[9px] text-amber-600">Log weight</p>}
            </div>
          </div>

          {/* Sodium */}
          <div className="text-center">
            <CircularProgress percentage={sodiumPct} color="from-rose-400 to-pink-500" size={70} strokeWidth={6} />
            <div className="mt-3">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Activity className="w-3.5 h-3.5 text-rose-500" />
                <p className="text-xs font-semibold text-gray-700">Sodium</p>
              </div>
              <p className="text-sm font-bold text-gray-900">{sodium.consumed.toLocaleString()}mg</p>
              <p className="text-[10px] text-gray-500">/ {sodium.target.toLocaleString()}mg</p>
            </div>
          </div>

          {/* Cholesterol */}
          <div className="text-center">
            <CircularProgress percentage={cholesterolPct} color="from-purple-400 to-violet-500" size={70} strokeWidth={6} />
            <div className="mt-3">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Heart className="w-3.5 h-3.5 text-purple-500" />
                <p className="text-xs font-semibold text-gray-700">Cholesterol</p>
              </div>
              <p className="text-sm font-bold text-gray-900">{cholesterol.consumed.toLocaleString()}mg</p>
              <p className="text-[10px] text-gray-500">/ {cholesterol.target.toLocaleString()}mg</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-gray-400 text-center mt-4 pt-3 border-t border-gray-100">
          Daily recommended limits
        </p>
      </div>
    </div>
  );
};

export default HeartHealthyCard;
