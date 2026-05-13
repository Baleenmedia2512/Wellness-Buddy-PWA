/**
 * StepCounterStats.js — circular progress ring + step/calorie tiles.
 *
 * Pure presentational. All numbers + ring geometry arrive as props from
 * `useStepCounter` (which derives them via `useStepGoals`).
 */
import React from 'react';
import { Footprints, Flame } from 'lucide-react';
import { RING_RADIUS, RING_CIRCUMFERENCE, STEP_GOAL } from '../services/stepCounterConstants';

const RingDisplay = ({ displaySteps, ringOffset }) => (
  <>
    <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
      <circle cx="100" cy="100" r={RING_RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="10" />
      <circle
        cx="100" cy="100" r={RING_RADIUS} fill="none"
        stroke="url(#stepGradient)" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={ringOffset}
        className="transition-all duration-700 ease-out"
      />
      <defs>
        <linearGradient id="stepGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#10b981" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
    </svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <Footprints className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500 mb-1" />
      <p className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-none">
        {displaySteps.toLocaleString()}
      </p>
      <p className="text-xs sm:text-sm text-gray-400 mt-1 font-medium">/ {STEP_GOAL.toLocaleString()}</p>
    </div>
  </>
);

const StatTile = ({ tone, Icon, value, label, loading }) => {
  const themes = {
    emerald: { wrap: 'bg-emerald-50', icon: 'text-emerald-600', value: 'text-emerald-900', label: 'text-emerald-600', skel: 'bg-emerald-200/60' },
    rose:    { wrap: 'bg-rose-50',    icon: 'text-rose-500',    value: 'text-rose-900',    label: 'text-rose-500',    skel: 'bg-rose-200/60' },
  };
  const t = themes[tone];
  return (
    <div className={`${t.wrap} rounded-2xl p-3.5 sm:p-4 text-center`}>
      <Icon className={`w-4 h-4 ${t.icon} mx-auto mb-1.5`} />
      {loading
        ? <div className={`h-6 w-16 ${t.skel} rounded-lg animate-pulse mx-auto`} />
        : <p className={`text-lg sm:text-xl font-bold ${t.value}`}>{value}</p>}
      <p className={`text-xs ${t.label} mt-0.5 font-medium`}>{label}</p>
    </div>
  );
};

export default function StepCounterStats({
  displaySteps, displayCalories, displayLoading,
  stepProgress, ringOffset, progressPct, reached,
}) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100/80 p-5 sm:p-7">
      <div className="flex flex-col items-center">
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 mb-4">
          {displayLoading ? (
            <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 animate-pulse" />
          ) : (
            <RingDisplay displaySteps={displaySteps} ringOffset={ringOffset} />
          )}
        </div>
        {!displayLoading && (
          <p className="text-sm text-gray-500 font-medium mb-1">
            {reached ? '🎉 Goal reached!' : `${progressPct}% of daily goal`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <StatTile tone="emerald" Icon={Footprints} loading={displayLoading}
          value={displaySteps.toLocaleString()} label="Steps" />
        <StatTile tone="rose" Icon={Flame} loading={displayLoading}
          value={displayCalories} label="Calories" />
      </div>
    </div>
  );
}
