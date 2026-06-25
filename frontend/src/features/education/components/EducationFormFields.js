/**
 * EducationFormFields.js — presentational.
 * Manual entry form: header bar + platform pills + error chip. No state.
 */
import React from 'react';
import { X } from 'lucide-react';

const PLATFORMS = ['Zoom', 'Microsoft Teams', 'Google Meet', 'In-person', 'Other'];

export default function EducationFormFields({
  platform, onSelectPlatform, error, onCancel, onBack,
}) {
  return (
    <>
      <div className="relative flex flex-col items-center px-4 pt-4 pb-3 border-b border-gray-100">
        {onBack && (
          <button
            onClick={onBack}
            className="absolute left-3 top-3 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <button onClick={onCancel} className="absolute right-3 top-3 p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
          <X className="w-4 h-4 text-gray-400" />
        </button>
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-2">
          <span className="text-xl">🎓</span>
        </div>
        <h2 className="text-sm font-bold text-gray-800">Manual Education Entry</h2>
        <p className="text-xs text-gray-400 mt-0.5">AI unavailable — log your session manually</p>
      </div>

      <div className="px-4 pt-3 pb-2 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Platform <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => onSelectPlatform(p)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  platform === p
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-xl">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
      </div>
    </>
  );
}
