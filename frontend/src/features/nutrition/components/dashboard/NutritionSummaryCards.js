import React from 'react';
import { TrendingUp, Beef, Wheat, Droplet, Leaf } from 'lucide-react';

const MacroTile = ({ icon: Icon, color, label, value, target }) => (
  <div className={`p-2 rounded-lg bg-${color}-50 flex flex-col items-center`}>
    <Icon className={`w-4 h-4 text-${color}-600 mb-0.5`} />
    <p className={`text-[10px] font-semibold text-${color}-600`}>{label}</p>
    <p className="text-sm font-bold text-gray-900">{value}g</p>
    <p className="text-[10px] text-gray-500">of {target}g</p>
  </div>
);

const NutritionSummaryCards = ({
  dailyStats,
  calorieTarget,
  consumedCalories,
  caloriesProgressPercent,
  calorieStatus,
  isOverTarget,
  burnedCalories,
  extraCalories,
  burnProgress,
  isBalanced,
  watchBurned,
  stepsBurned,
  summaryPanelRef,
}) => {
  return (
    <div ref={summaryPanelRef} className="w-1/2 shrink-0 px-4 md:px-5 pb-4 md:pb-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs md:text-sm text-gray-500">Calories Consumed</p>
          <p className="text-xl md:text-2xl font-bold text-gray-900">
            {consumedCalories}
            <span className="text-xs md:text-sm font-normal text-gray-500"> / {calorieTarget} kcal</span>
          </p>
        </div>
        <div className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full ${calorieStatus.className}`}>
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <span className="text-xs md:text-sm font-medium">{calorieStatus.label}</span>
        </div>
      </div>

      <p className="text-[11px] md:text-xs text-gray-500 mb-3">{calorieStatus.hint}</p>

      <div className="w-full bg-gray-200/70 rounded-full h-2 mb-4 overflow-hidden">
        <div
          className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${caloriesProgressPercent}%` }}
        />
      </div>

      <div className="mb-4 rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs md:text-sm font-semibold text-orange-700">Burn to Balance</p>
          {isBalanced && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
              ✅ Balanced
            </span>
          )}
        </div>

        <div className="flex items-end justify-between mb-1.5">
          <div>
            <p className="text-xl md:text-2xl font-bold text-gray-900">
              {burnedCalories}
              <span className="text-xs md:text-sm font-normal text-gray-500">
                {' '}/ {isOverTarget ? extraCalories : 0} kcal
              </span>
            </p>
            {watchBurned > 0 && stepsBurned === 0 && (
              <p className="text-[10px] text-gray-400 mt-0.5">⌚ From smartwatch</p>
            )}
          </div>
          <p className={`text-[11px] font-medium ${isOverTarget ? 'text-orange-600' : 'text-emerald-600'}`}>
            {isOverTarget ? `${burnProgress}% burned` : '✅ Within Target'}
          </p>
        </div>

        <div className="w-full bg-orange-100 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-700 ease-out ${
              isBalanced
                ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                : 'bg-gradient-to-r from-orange-400 via-red-400 to-rose-500'
            }`}
            style={{ width: `${burnProgress}%` }}
          />
        </div>

        <p className="text-[10px] text-gray-500 mt-1.5">
          {isBalanced
            ? "Great work! You've balanced today's extra calories."
            : isOverTarget
              ? `Burn ${extraCalories - burnedCalories} more kcal to balance today's intake.`
              : 'Keep burning calories to stay active and healthy!'}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MacroTile icon={Beef} color="blue" label="Protein" value={Math.round(dailyStats.totalProtein) || 0} target={131} />
        <MacroTile icon={Wheat} color="orange" label="Carbs" value={Math.round(dailyStats.totalCarbs) || 0} target={263} />
        <MacroTile icon={Droplet} color="yellow" label="Fat" value={Math.round(dailyStats.totalFat) || 0} target={70} />
        <MacroTile icon={Leaf} color="green" label="Fiber" value={Math.round(dailyStats.totalFiber) || 0} target={30} />
      </div>
    </div>
  );
};

export default NutritionSummaryCards;
