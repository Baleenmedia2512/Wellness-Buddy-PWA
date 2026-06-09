/**
 * frontend/src/shell/components/DashboardTabs.jsx
 *
 * Extracted from Dashboard.js in PR-C / ADR-0003. Owns the tab
 * navigation strip and the two custom inline SVG icons
 * (WeighingScale, Education) used only here.
 *
 * Pure presentational — receives `activeTab`, `onTabChange`, and a
 * `diaryEnabled` flag. Owns no state, no effects, no I/O.
 *
 * Why extract:
 *   Dashboard.js was over the §2.3 file-size FAIL threshold (500 LOC)
 *   after PR-C added the Diary tab. Splitting the tab strip + icon
 *   defs into their own file brings Dashboard.js back under threshold
 *   without changing any behaviour.
 */

import React from 'react';
import { AppleIcon, BookOpen } from 'lucide-react';
import TouchFeedbackButton from '../../shared/components/TouchFeedbackButton';

// Custom weighing scale icon — was inline in Dashboard.js.
const WeighingScaleIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
    <path d="M6 10 C6 7, 18 7, 18 10" />
    <line x1="8" y1="8.5" x2="8" y2="9.5" />
    <line x1="12" y1="7" x2="12" y2="8" />
    <line x1="16" y1="8.5" x2="16" y2="9.5" />
    <line x1="12" y1="12" x2="12" y2="9" />
  </svg>
);

// Custom education book icon — was inline in Dashboard.js.
const EducationIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M12 6v7" />
    <path d="M10 11l2 2 2-2" />
  </svg>
);

const TAB_BASE_CLASS =
  'flex items-center justify-center gap-1.5 md:gap-2 py-3 px-6 md:px-10 ' +
  'text-[12px] md:text-sm whitespace-nowrap font-medium border-b-2 ' +
  'transition-colors rounded-t-lg';

function tabClass(isActive) {
  return `${TAB_BASE_CLASS} ${
    isActive
      ? 'border-green-600 text-green-700'
      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
  }`;
}

export default function DashboardTabs({ activeTab, onTabChange, diaryEnabled }) {
  return (
    <div className="flex justify-center border-b border-gray-200">
      <TouchFeedbackButton
        onClick={() => onTabChange('nutrition')}
        className={tabClass(activeTab === 'nutrition')}
      >
        <AppleIcon
          className="h-4 w-4 flex-shrink-0"
          strokeWidth={3}
          style={{
            stroke: activeTab === 'nutrition' ? '#16a34a' : 'currentColor',
            fill: 'none',
          }}
        />
        <span>Food</span>
      </TouchFeedbackButton>

      <TouchFeedbackButton
        onClick={() => onTabChange('weight')}
        className={tabClass(activeTab === 'weight')}
      >
        <WeighingScaleIcon className="h-4 w-4 flex-shrink-0" />
        <span>Weight</span>
      </TouchFeedbackButton>

      <TouchFeedbackButton
        onClick={() => onTabChange('education')}
        className={tabClass(activeTab === 'education')}
      >
        <EducationIcon className="h-4 w-4 flex-shrink-0" />
        <span>Education</span>
      </TouchFeedbackButton>

      {/* PR-C / ADR-0003 — Diary tab. Mounted only when ff.diary-feed is ON. */}
      {diaryEnabled && (
        <TouchFeedbackButton
          onClick={() => onTabChange('diary')}
          className={tabClass(activeTab === 'diary')}
        >
          <BookOpen className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>Diary</span>
        </TouchFeedbackButton>
      )}
    </div>
  );
}
