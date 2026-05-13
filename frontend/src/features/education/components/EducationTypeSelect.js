/**
 * EducationTypeSelect.js — presentational.
 * "AI unavailable → Log Education" intro screen of the manual entry modal.
 */
import React from 'react';
import { X } from 'lucide-react';

export default function EducationTypeSelect({ onPick, onCancel }) {
  return (
    <>
      <div className="flex items-start justify-between px-4 pt-4 pb-2 flex-shrink-0">
        <div>
          <p className="text-sm font-bold text-gray-900 leading-snug">AI Unavailable</p>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-snug max-w-[220px]">
            AI couldn&apos;t detect your input. Please log manually.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-1.5 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      <div className="px-4 pb-3">
        <button
          onClick={onPick}
          className="w-full text-white rounded-[16px] py-3 px-4 flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.97]"
          style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 60%, #60a5fa 100%)',
            boxShadow: '0 6px 18px rgba(37,99,235,0.30)',
          }}
        >
          <span className="text-2xl leading-none">🎓</span>
          <span className="text-sm font-bold tracking-tight">Log Education</span>
          <span className="text-[11px] font-normal opacity-80">It&apos;s education time! Log manually</span>
        </button>
      </div>
    </>
  );
}
