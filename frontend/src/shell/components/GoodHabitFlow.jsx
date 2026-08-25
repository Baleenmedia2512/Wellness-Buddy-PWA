/**
 * Good Habit Manual Log — single photo.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Images, Loader2, X } from 'lucide-react';
import { GOOD_HABIT_SUBTYPE } from '../domain/manualLogCategories';
import {
  GOOD_HABIT_IMAGE_MAX_DIMENSION_PX,
  GOOD_HABIT_IMAGE_TARGET_BYTES,
} from '../../shared/constants/limits';
import { toStorageThumbnail } from '../../shared/utils/storageThumbnail';

const THUMB_OPTS = {
  targetBytes: GOOD_HABIT_IMAGE_TARGET_BYTES,
  maxDim: GOOD_HABIT_IMAGE_MAX_DIMENSION_PX,
};

const SAVE_BTN =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white shadow-[0_3px_0_0_#064e3b] active:translate-y-[2px] disabled:opacity-50';

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

async function compressPickedFile(file) {
  const dataUrl = await readFileAsDataUrl(file);
  return toStorageThumbnail(dataUrl, THUMB_OPTS);
}

function ImageSlot({ image, onPick, compressing }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      {image?.preview ? (
        <img src={image.preview} alt="Good Habit preview" className="h-52 w-full rounded-xl border border-emerald-200 object-cover" />
      ) : (
        <>
          <div className="flex h-52 w-full items-center justify-center rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 text-emerald-400">
            {compressing ? <Loader2 className="h-8 w-8 animate-spin" aria-hidden /> : <Images className="h-8 w-8" aria-hidden />}
          </div>
          <div className="flex w-full gap-2">
            <button type="button" onClick={() => cameraRef.current?.click()} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 py-2 text-xs font-bold text-white">
              <Camera className="h-4 w-4" aria-hidden /> Camera
            </button>
            <button type="button" onClick={() => galleryRef.current?.click()} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 py-2 text-xs font-bold text-emerald-800">
              <Images className="h-4 w-4" aria-hidden /> Gallery
            </button>
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
          <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
        </>
      )}
    </div>
  );
}

export default function GoodHabitFlow({
  isOpen,
  onClose,
  onSave,
  capturedPreview = null,
}) {
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [compressing, setCompressing] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    setImage(capturedPreview ? { preview: capturedPreview, base64: capturedPreview } : null);
    setSaving(false);
    setError(null);
    setCompressing(false);
    return undefined;
  }, [isOpen, capturedPreview]);

  const pickImage = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setImage({ preview, base64: null, compressing: true });
    setCompressing(true);
    setError(null);
    try {
      const base64 = await compressPickedFile(file);
      setImage({ preview: base64 || preview, base64, compressing: false });
    } catch (err) {
      URL.revokeObjectURL(preview);
      setImage(null);
      setError(err?.message || 'Could not read that image.');
    } finally {
      setCompressing(false);
    }
  }, []);

  if (!isOpen) return null;

  const busy = saving || compressing;
  const canSave = Boolean(image?.base64) && !busy;

  const handleSave = async () => {
    if (!image?.base64) {
      setError('Upload a photo to save.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave?.({
        habitType: GOOD_HABIT_SUBTYPE.IMAGE_NOTES,
        notes: '',
        imageBase64: image.base64,
        shareImage: image.base64,
      });
    } catch (err) {
      setError(err?.message || "Couldn't save Good Habit.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="good-habit-title">
      <div className="flex w-full max-w-sm flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between px-4 pb-2 pt-4">
          <div>
            <p id="good-habit-title" className="text-sm font-bold leading-snug text-emerald-900">Good Habit</p>
            <p className="mt-0.5 text-[11px] leading-snug text-emerald-700/70">
              Click Save if this photo shows a good habit you started today.
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex-shrink-0 rounded-xl p-1.5 hover:bg-emerald-50" aria-label="Close">
            <X className="h-4 w-4 text-emerald-600/60" />
          </button>
        </div>

        {error && (
          <p className="mx-4 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>
        )}

        <div className="flex flex-col gap-3 px-4 pb-4">
          <ImageSlot image={image} compressing={compressing} onPick={pickImage} />
          <button type="button" disabled={!canSave} onClick={handleSave} className={SAVE_BTN}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Save Good Habit
          </button>
        </div>
      </div>
    </div>
  );
}
