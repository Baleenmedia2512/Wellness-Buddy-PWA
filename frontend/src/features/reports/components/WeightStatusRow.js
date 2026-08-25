/**
 * WeightStatusRow.js — Single member row in the Downline Weight Status report.
 * Pure presentational component; receives a fully-computed row object.
 */
import React from 'react';
import { User } from 'lucide-react';
import WeightStatusBadge from './WeightStatusBadge';

/**
 * Compute the progress-bar fill percentage and colour.
 * The bar represents the current weight position on a range from
 * (idealMin - 10 kg) to (idealMax + 10 kg).
 */
function getBarProps(currentWeight, idealMin, idealMax) {
  if (currentWeight === null || idealMin === null || idealMax === null) return null;
  const low  = idealMin - 10;
  const high = idealMax + 10;
  const pct  = Math.min(100, Math.max(0, ((currentWeight - low) / (high - low)) * 100));
  const idealStartPct = ((idealMin - low) / (high - low)) * 100;
  const idealEndPct   = ((idealMax - low) / (high - low)) * 100;
  return { pct, idealStartPct, idealEndPct };
}

export default function WeightStatusRow({ row, teamPerformance = null }) {
  const { userName, email, communityId, currentWeight, idealMin, idealMax, status } = row;
  const bar = getBarProps(currentWeight, idealMin, idealMax);
  const mail = String(email || '').trim();
  const cid = String(communityId || '').trim();
  const subtitle = mail && cid ? `${mail} | ${cid}` : (mail || cid);

  let deltaLabel = null;
  if (currentWeight !== null && idealMin !== null && idealMax !== null) {
    if (status === 'above_ideal') {
      const diff = (currentWeight - idealMax).toFixed(1);
      deltaLabel = `${diff} kg above ideal`;
    } else if (status === 'below_ideal') {
      const diff = (idealMin - currentWeight).toFixed(1);
      deltaLabel = `${diff} kg below ideal`;
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-50 flex items-center justify-center">
            <User className="h-4 w-4 text-green-600" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-gray-800 text-sm truncate block">{userName}</span>
            {subtitle ? (
              <span className="text-[11px] text-gray-500 truncate block">{subtitle}</span>
            ) : null}
          </div>
        </div>
        <WeightStatusBadge status={status} />
      </div>

      {/* Weight details */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
        <div>
          <span className="text-gray-400">Current</span>
          <p className="font-semibold text-gray-800 text-sm mt-0.5">
            {currentWeight !== null ? `${currentWeight} kg` : '—'}
          </p>
        </div>
        <div>
          <span className="text-gray-400">Ideal range</span>
          <p className="font-semibold text-gray-800 text-sm mt-0.5">
            {idealMin !== null && idealMax !== null
              ? `${idealMin} – ${idealMax} kg`
              : '—'}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {bar && (
        <div className="mt-3">
          <div className="relative h-2 rounded-full bg-gray-100 overflow-hidden">
            {/* Ideal zone highlight */}
            <div
              className="absolute inset-y-0 bg-green-100"
              style={{
                left:  `${bar.idealStartPct}%`,
                width: `${bar.idealEndPct - bar.idealStartPct}%`,
              }}
            />
            {/* Current weight marker */}
            <div
              className={`absolute inset-y-0 w-1 rounded-full ${
                status === 'above_ideal'
                  ? 'bg-orange-400'
                  : status === 'below_ideal'
                  ? 'bg-blue-400'
                  : 'bg-green-500'
              }`}
              style={{ left: `${Math.max(0, bar.pct - 0.5)}%` }}
            />
          </div>
          {deltaLabel && (
            <p className={`mt-1 text-xs font-medium ${
              status === 'above_ideal' ? 'text-orange-600' : 'text-blue-600'
            }`}>
              {deltaLabel}
            </p>
          )}
        </div>
      )}

      {teamPerformance && (
        <p className={`text-xs font-medium ${bar ? 'mt-1.5' : 'mt-3'}`}>
          <span className="text-orange-600">{teamPerformance.offTrackPct}% off track</span>
          <span className="text-gray-300 mx-1.5">|</span>
          <span className="text-green-600">{teamPerformance.onTrackPct}% on track</span>
          {teamPerformance.totalMembers > 0 && (
            <span className="text-gray-400 ml-1.5">
              ({teamPerformance.totalMembers} active)
            </span>
          )}
        </p>
      )}
    </div>
  );
}
