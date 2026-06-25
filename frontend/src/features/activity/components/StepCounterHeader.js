/**
 * StepCounterHeader.js — sticky top bar.
 *
 * Pure presentational. Receives back/refresh/save indicators as props
 * and emits an onBack + onRefresh callback. No business logic.
 */
import React from 'react';
import { ArrowLeft, Footprints, RefreshCw } from 'lucide-react';

export default function StepCounterHeader({
  onBack, isViewingOther, selectedMember,
  refreshing, refreshDone, saving, onRefresh,
}) {
  return (
    <div className="bg-white/90 backdrop-blur-lg border-b border-emerald-100/50 sticky top-0 z-10">
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl hover:bg-emerald-50 active:bg-emerald-100 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
        )}
        <div className="flex items-center gap-2.5 flex-1">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-500 p-2 rounded-xl shadow-sm">
            <Footprints className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Step Counter</h1>
            {isViewingOther && (
              <p className="text-xs text-emerald-600 font-medium">Viewing {selectedMember.userName}'s data</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isViewingOther && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh steps"
              title="Refresh Steps"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-95 ${
                refreshDone
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                  : refreshing
                  ? 'bg-emerald-100 text-emerald-600 cursor-not-allowed'
                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:shadow-sm'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing…' : refreshDone ? '✓ Updated' : 'Refresh'}</span>
            </button>
          )}
          {saving && (
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Saving..." />
          )}
        </div>
      </div>
    </div>
  );
}
