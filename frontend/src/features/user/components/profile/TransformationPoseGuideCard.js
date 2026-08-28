/**
 * Pose teaching visuals for Left / Centre / Right capture.
 * Used as the empty-state guide inside the upload frame.
 */
import React from 'react';
import { POSE_TAB_GUIDE } from '../../domain/transformationPoseGuide';
import poseFront from '../../assets/pose-front.jpg';
import poseLeft from '../../assets/pose-left.jpg';
import poseRight from '../../assets/pose-right.jpg';

/** Left tab: profile facing left. Right tab: profile facing right. Shadow silhouettes, not photos. */
const POSE_IMAGES = {
  front: poseFront,
  left: poseRight,
  right: poseLeft,
};

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
  const frame = variant === 'frame';
  const src = POSE_IMAGES[poseType] || poseFront;

  if (frame) {
    return (
      <div className="relative h-full w-full min-h-0">
        <img
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-contain object-center p-3 pb-16"
        />
        <div className="absolute inset-x-0 bottom-0 px-3 pt-8 pb-2 bg-gradient-to-t from-white via-white/90 to-transparent text-center">
          <p className="text-sm font-semibold text-slate-800 leading-snug">{guide.tip}</p>
          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
            Use Camera or Gallery below
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 flex items-center gap-3">
      <img src={src} alt="" className="w-12 h-14 object-contain shrink-0" />
      <p className="text-xs font-medium text-slate-700 leading-snug min-w-0">{guide.tip}</p>
    </div>
  );
}
