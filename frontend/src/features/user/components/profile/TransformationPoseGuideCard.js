/**
 * Pose teaching visuals for Centre / Left / Right capture.
 * Used as the empty-state guide inside the upload frame.
 */
import React from 'react';
import { POSE_TAB_GUIDE } from '../../domain/transformationPoseGuide';

/** Front / centre — face the camera (bust + face). */
const PoseCentre = ({ className = 'w-28 h-36' }) => (
  <svg viewBox="0 0 160 200" className={className} aria-hidden fill="none">
    {/* phone / frame hint */}
    <rect x="28" y="8" width="104" height="184" rx="16" stroke="currentColor" strokeWidth="3" opacity="0.2" />
    {/* head */}
    <ellipse cx="80" cy="62" rx="32" ry="38" stroke="currentColor" strokeWidth="3.5" className="animate-pulse" />
    {/* eyes */}
    <circle cx="66" cy="56" r="4" fill="currentColor" opacity="0.7" />
    <circle cx="94" cy="56" r="4" fill="currentColor" opacity="0.7" />
    {/* smile */}
    <path d="M64 78 Q80 90 96 78" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
    {/* shoulders */}
    <path
      d="M40 118 Q80 102 120 118 L128 170 Q80 158 32 170 Z"
      fill="currentColor"
      opacity="0.18"
      stroke="currentColor"
      strokeWidth="2.5"
    />
    {/* arrow toward camera */}
    <path d="M80 188 L80 176 M72 182 L80 176 L88 182" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
  </svg>
);

/** Side profile — full body silhouette; faceRight = nose points right (Right tab). */
const PoseSide = ({ faceRight = true, className = 'w-24 h-40' }) => (
  <svg
    viewBox="0 0 140 220"
    className={`${className} ${faceRight ? '' : '-scale-x-100'}`}
    aria-hidden
    fill="currentColor"
  >
    <g className="animate-pulse" opacity="0.85">
      {/* head */}
      <ellipse cx="78" cy="32" rx="16" ry="22" />
      {/* nose / face direction */}
      <path d="M92 30 L108 36 L92 42 Z" opacity="0.95" />
      {/* torso */}
      <path d="M58 56 L88 62 L94 128 L62 136 L52 78 Z" opacity="0.75" />
      {/* near arm down */}
      <path d="M58 70 L42 118 L52 122 L68 78 Z" opacity="0.55" />
      {/* far arm hint */}
      <path d="M86 72 L102 110 L92 114 L78 78 Z" opacity="0.4" />
      {/* legs */}
      <rect x="64" y="132" width="14" height="70" rx="7" opacity="0.7" />
      <rect x="78" y="134" width="12" height="68" rx="6" opacity="0.55" />
      {/* feet */}
      <ellipse cx="68" cy="204" rx="12" ry="5" opacity="0.6" />
      <ellipse cx="88" cy="204" rx="10" ry="5" opacity="0.5" />
    </g>
    {/* floor line */}
    <line x1="24" y1="210" x2="116" y2="210" stroke="currentColor" strokeWidth="2" opacity="0.25" fill="none" />
  </svg>
);

/**
 * @param {{
 *   poseType?: 'front'|'left'|'right',
 *   variant?: 'banner'|'frame',
 * }} props
 */
export default function TransformationPoseGuideCard({
  poseType = 'front',
  variant = 'banner',
}) {
  const guide = POSE_TAB_GUIDE[poseType] || POSE_TAB_GUIDE.front;
  const icon =
    poseType === 'front' ? (
      <PoseCentre className={variant === 'frame' ? 'w-32 h-40 text-emerald-600' : 'w-14 h-16 text-emerald-600'} />
    ) : (
      <PoseSide
        faceRight={poseType === 'right'}
        className={variant === 'frame' ? 'w-28 h-44 text-emerald-600' : 'w-11 h-14 text-emerald-600'}
      />
    );

  if (variant === 'frame') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 text-center max-w-[240px]">
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-5 py-3 shadow-sm">
          {icon}
        </div>
        <p className="text-sm font-semibold text-gray-800 leading-snug">{guide.tip}</p>
        <p className="text-[11px] text-gray-500 leading-snug">
          Use Camera or Gallery below
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 flex items-center gap-3">
      <div className="shrink-0 flex items-center justify-center">{icon}</div>
      <p className="text-xs font-medium text-gray-700 leading-snug min-w-0">{guide.tip}</p>
    </div>
  );
}
