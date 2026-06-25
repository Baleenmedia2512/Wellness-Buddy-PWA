/**
 * WaterGlass.js — presentational.
 * Header + progress bar + discipline status panel.
 * Receives a fully pre-formatted viewmodel; no calculations performed here.
 */
import React from 'react';
import { Droplets, CheckCircle, RefreshCw } from 'lucide-react';

export default function WaterGlass({
  goalSubtitle,
  totalLabel,
  requiredLabel,
  remainingLabel,
  progressPercent,
  achieved,
  hasData,
  loading,
  onRefresh,
}) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 rounded-xl">
            <Droplets className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">Water Intake</h3>
            <p className="text-xs text-gray-400">{goalSubtitle}</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-medium">
          <span className="text-blue-600">{totalLabel} logged</span>
          <span className="text-gray-400">{requiredLabel} goal</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              achieved ? 'bg-green-400' : 'bg-blue-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="text-xs text-right text-gray-400">{progressPercent}%</div>
      </div>

      {/* Discipline status */}
      {hasData && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${
            achieved ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
          }`}
        >
          {achieved ? (
            <>
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Discipline Achieved! 🎉 Great job staying hydrated.</span>
            </>
          ) : (
            <>
              <Droplets className="w-4 h-4 flex-shrink-0" />
              <span>
                Drink <strong>{remainingLabel}</strong> more to reach your daily goal.
              </span>
            </>
          )}
        </div>
      )}
    </>
  );
}
