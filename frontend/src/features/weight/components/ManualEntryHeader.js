/**
 * ManualEntryHeader.js — presentational.
 * Top bar of the manual weight-entry form (back + close + title + scale icon).
 */
import React from 'react';
import { X } from 'lucide-react';

const WeighingScaleIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
    <path d="M6 10 C6 7, 18 7, 18 10" />
    <line x1="8" y1="8.5" x2="8" y2="9.5" />
    <line x1="12" y1="7" x2="12" y2="8" />
    <line x1="16" y1="8.5" x2="16" y2="9.5" />
    <line x1="12" y1="12" x2="12" y2="9" />
  </svg>
);

export default function ManualEntryHeader({ onBack, onCancel }) {
  return (
    <div className="relative flex flex-col items-center px-4 pt-4 pb-3 border-b border-gray-100">
      {onBack && (
        <button
          onClick={onBack}
          className="absolute left-3 top-3 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          title="Back"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <button
        onClick={onCancel}
        className="absolute right-3 top-3 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
      >
        <X className="w-4 h-4 text-gray-400" />
      </button>
      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-2">
        <WeighingScaleIcon className="w-5 h-5 text-green-600" />
      </div>
      <h2 className="text-sm font-bold text-gray-800">Enter Weight Manually</h2>
      <p className="text-xs text-gray-400 mt-0.5">Could not detect weight automatically</p>
    </div>
  );
}
