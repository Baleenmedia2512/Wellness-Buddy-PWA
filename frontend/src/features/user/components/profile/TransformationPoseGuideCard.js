/**
 * Compact pose hint — silhouette + one-line tip (no long copy).
 */
import React from 'react';
import { POSE_TAB_GUIDE } from '../../domain/transformationPoseGuide';

const PulseFace = () => (
  <svg viewBox="0 0 120 140" className="w-11 h-12 text-emerald-600" aria-hidden>
    <ellipse cx="60" cy="58" rx="28" ry="34" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="6 4" className="animate-pulse" />
    <circle cx="48" cy="52" r="3" fill="currentColor" opacity="0.55" />
    <circle cx="72" cy="52" r="3" fill="currentColor" opacity="0.55" />
    <path d="M48 72 Q60 80 72 72" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
  </svg>
);

const PulseSide = ({ faceRight }) => (
  <svg
    viewBox="0 0 120 220"
    className={`w-9 h-12 text-emerald-600 ${faceRight ? '' : '-scale-x-100'}`}
    aria-hidden
  >
    <g className="animate-pulse">
      <ellipse cx="72" cy="28" rx="13" ry="20" fill="currentColor" opacity="0.85" />
      <path d="M84 28 L98 32 L84 36 Z" fill="currentColor" opacity="0.9" />
      <path d="M55 52 L80 58 L84 125 L58 132 L48 72 Z" fill="currentColor" opacity="0.7" />
      <rect x="60" y="128" width="16" height="72" rx="6" fill="currentColor" opacity="0.65" />
    </g>
  </svg>
);

/**
 * @param {{ poseType: 'front'|'left'|'right' }} props
 */
export default function TransformationPoseGuideCard({ poseType = 'front' }) {
  const guide = POSE_TAB_GUIDE[poseType] || POSE_TAB_GUIDE.front;

  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 flex items-center gap-3">
      <div className="shrink-0 flex items-center justify-center">
        {poseType === 'front' ? <PulseFace /> : <PulseSide faceRight={poseType === 'left'} />}
      </div>
      <p className="text-xs font-medium text-gray-700 leading-snug min-w-0">{guide.tip}</p>
    </div>
  );
}
