/**
 * Transformation photos — Left / Centre / Right tabs.
 * Portrait (9:16) frames match testimonial before/after upload UX.
 * Camera / Gallery use icon buttons → system picker (no in-frame live camera).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Images } from 'lucide-react';
import TransformationPoseGuideCard from './TransformationPoseGuideCard';
import { PORTRAIT_IMAGE_CLASS } from '../../../testimonials/services/testimonialFormUtils.js';
import usePortraitCoverCrop from '../../hooks/usePortraitCoverCrop';
import { portraitCropWindowStyle } from '../../domain/transformationCropPreview';
import {
  DEFAULT_POSE_SLOT,
  POSE_SLOT_KEYS,
  POSE_TAB_GUIDE,
  nextEmptyTransformationSlot,
} from '../../domain/transformationPoseGuide';

const PORTRAIT_FRAME_MAX = 'max-w-[200px]';
const PORTRAIT_PLACEHOLDER_CLASS =
  `w-full ${PORTRAIT_FRAME_MAX} mx-auto aspect-[9/16] rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden relative`;

function CropWindowPreview({ src, area, alt, onError }) {
  const [size, setSize] = useState(null);
  const style = portraitCropWindowStyle(area, size?.w, size?.h);
  return (
    <span className="relative block w-full aspect-[9/16] overflow-hidden rounded-2xl border-2 border-emerald-400 bg-gray-100">
      <img
        src={src}
        alt={alt}
        onLoad={(e) => {
          const img = e.currentTarget;
          setSize({ w: img.naturalWidth, h: img.naturalHeight });
        }}
        onError={onError}
        className={`absolute block max-w-none ${style ? '' : 'h-full w-full opacity-0'}`}
        style={style || undefined}
      />
    </span>
  );
}

const TransformationPhotosSection = ({
  onSelectFile,
  selectedType = DEFAULT_POSE_SLOT,
  onSelectType,
  previews = {},
  disabled = false,
}) => {
  const [busy, setBusy] = useState(false);
  const [brokenSlots, setBrokenSlots] = useState({});
  const [cropError, setCropError] = useState('');
  const [cropPreviews, setCropPreviews] = useState({});
  const [cropFrames, setCropFrames] = useState({});
  const originalsRef = useRef({});
  const cameraRef = React.useRef(null);
  const galleryRef = React.useRef(null);
  const poseTypeRef = useRef(selectedType);

  const poseType = POSE_SLOT_KEYS.includes(selectedType) ? selectedType : DEFAULT_POSE_SLOT;
  poseTypeRef.current = poseType;
  const storedPreview = previews?.[poseType] || null;
  const frame = cropFrames[poseType];
  const showFramedOriginal = Boolean(frame?.src)
    && !frame.rotation
    && Number(frame.area?.width) > 0
    && Number(frame.area?.height) > 0;
  const preview = showFramedOriginal
    ? frame.src
    : (cropPreviews[poseType] || storedPreview);
  const guide = POSE_TAB_GUIDE[poseType] || POSE_TAB_GUIDE.front;
  const captureFacing = poseType === 'front' ? 'user' : 'environment';
  const showPreview = Boolean(preview) && !brokenSlots[poseType];

  const coverCrop = usePortraitCoverCrop({
    onApply: async (croppedUrl, key, originalUrl, croppedAreaPixels, rotation = 0) => {
      const slot = POSE_SLOT_KEYS.includes(key) ? key : poseTypeRef.current;
      const original = originalUrl || originalsRef.current[slot] || null;
      if (original) originalsRef.current[slot] = original;
      const turned = Number(rotation) || 0;
      const canFrame = Boolean(original)
        && !turned
        && Number(croppedAreaPixels?.width) > 0
        && Number(croppedAreaPixels?.height) > 0;
      setBusy(true);
      setCropError('');
      try {
        if (canFrame) {
          setCropFrames((prev) => ({
            ...prev,
            [slot]: { src: original, area: croppedAreaPixels, rotation: 0 },
          }));
          setCropPreviews((prev) => ({ ...prev, [slot]: null }));
        } else if (croppedUrl) {
          setCropFrames((prev) => ({ ...prev, [slot]: null }));
          setCropPreviews((prev) => ({ ...prev, [slot]: croppedUrl }));
        }
        await onSelectFile?.(slot, original || croppedUrl);
        setBrokenSlots((prev) => ({ ...prev, [slot]: false }));
        const next = nextEmptyTransformationSlot(
          { ...previews, [slot]: 'filled' },
          slot,
        );
        if (next) onSelectType?.(next);
      } catch (err) {
        setCropError(err?.message || 'Failed to prepare photo.');
      } finally {
        setBusy(false);
      }
    },
    onError: setCropError,
  });

  useEffect(() => {
    setBrokenSlots({});
  }, [previews?.front, previews?.left, previews?.right]);

  const handleFile = (file) => {
    if (!file) return;
    setCropError('');
    void coverCrop.pickFile(file, poseTypeRef.current);
  };

  return (
    <div className="flex flex-col gap-3">
      {coverCrop.overlay}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
        {POSE_SLOT_KEYS.map((type) => {
          const hasPhoto = Boolean(previews?.[type]) && !brokenSlots[type];
          const active = type === poseType;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelectType?.(type)}
              className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 ${
                active
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              {hasPhoto ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : null}
              {POSE_TAB_GUIDE[type]?.label || type}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center justify-center gap-2 py-1">
        {showPreview ? (
          <button
            type="button"
            onClick={() => {
              setCropError('');
              void coverCrop.recrop(originalsRef.current[poseType] || storedPreview, poseType);
            }}
            disabled={disabled || busy || coverCrop.isPreparing}
            aria-label={`Adjust ${guide.label} photo`}
            className={`relative block w-full ${PORTRAIT_FRAME_MAX} mx-auto overflow-hidden rounded-2xl disabled:opacity-60`}
          >
            {showFramedOriginal ? (
              <CropWindowPreview
                src={frame.src}
                area={frame.area}
                alt={guide.label}
                onError={() => {
                  setBrokenSlots((prev) => ({ ...prev, [poseType]: true }));
                }}
              />
            ) : (
              <img
                src={preview}
                alt={guide.label}
                className={`${PORTRAIT_IMAGE_CLASS} border-emerald-400`}
                onError={() => {
                  setBrokenSlots((prev) => ({ ...prev, [poseType]: true }));
                }}
              />
            )}
            {(busy || coverCrop.isPreparing) ? (
              <span className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-white text-[11px] font-semibold">Preparing…</span>
              </span>
            ) : null}
          </button>
        ) : (
          <div className={PORTRAIT_PLACEHOLDER_CLASS}>
            <TransformationPoseGuideCard poseType={poseType} variant="frame" />
            {coverCrop.isPreparing ? (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-white text-[11px] font-semibold">Preparing…</span>
              </div>
            ) : null}
          </div>
        )}

        <p className="text-[11px] text-gray-400 text-center px-2">
          {showPreview ? 'Tap photo to drag or pinch the visible area' : 'Portrait orientation (vertical) only'}
        </p>
        {cropError ? (
          <p className="text-[11px] text-red-600 text-center px-2">{cropError}</p>
        ) : null}

        <div className={`grid grid-cols-2 gap-2 w-full ${PORTRAIT_FRAME_MAX} mx-auto`}>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture={captureFacing}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) handleFile(file);
            }}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) handleFile(file);
            }}
          />
          <button
            type="button"
            disabled={disabled || busy || coverCrop.isPreparing}
            onClick={() => cameraRef.current?.click()}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold shadow disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            Camera
          </button>
          <button
            type="button"
            disabled={disabled || busy || coverCrop.isPreparing}
            onClick={() => galleryRef.current?.click()}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 text-xs font-bold hover:border-green-400 hover:text-green-700 disabled:opacity-50"
          >
            <Images className="w-4 h-4" />
            Gallery
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransformationPhotosSection;
