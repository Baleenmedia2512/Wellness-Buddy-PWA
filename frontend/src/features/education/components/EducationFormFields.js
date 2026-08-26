/**
 * EducationFormFields.js — presentational.
 * Manual entry form: header bar + platform pills + error chip. No state.
 */
import React from 'react';
import { X } from 'lucide-react';
import { EmojiOrNative } from '../../../shared/components/icons/EmojiImage';

const EDUCATION_ICON_SRC = '/education.svg';

function EducationHeaderIcon() {
  const base = process.env.PUBLIC_URL || '';
  return (
    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8f5e9]">
      <img
        src={`${base}${EDUCATION_ICON_SRC}`}
        alt=""
        draggable={false}
        className="h-5 w-5 select-none object-contain"
      />
    </div>
  );
}

const PLATFORMS = ['Zoom', 'Microsoft Teams', 'Google Meet', 'In-person', 'Other'];

export const MEETING_SESSIONS = [
  'Blueprint for Success',
  'HALA',
  'Daily Education',
  'Wellness Seminar',
  'Academy',
];

export const DEFAULT_MEETING_SESSION = 'Daily Education';

export default function EducationFormFields({
  platform,
  onSelectPlatform,
  topic,
  onSelectTopic,
  error,
  onCancel,
  onBack,
  formTitle = 'Manual Education Entry',
  formSubtitle = 'AI unavailable — log your session manually',
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
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
        >
          <X className="h-5 w-5" strokeWidth={2.25} />
        </button>
        <EducationHeaderIcon />
        <h2 className="text-sm font-bold text-gray-800">{formTitle}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{formSubtitle}</p>
      </div>

      <div className="px-4 pt-3 pb-2 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Meeting session <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {MEETING_SESSIONS.map((session) => (
              <button
                key={session}
                type="button"
                onClick={() => onSelectTopic(session)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  topic === session
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-200 hover:bg-emerald-50/60'
                }`}
              >
                {session}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Platform <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onSelectPlatform(p)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  platform === p
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-200 hover:bg-emerald-50/60'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-xl">
            <EmojiOrNative emoji="⚠️" className="w-4 h-4" nativeClassName="text-sm" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </>
  );
}
