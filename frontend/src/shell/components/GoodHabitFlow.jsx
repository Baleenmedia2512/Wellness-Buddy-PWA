/**
 * Good Habit Manual Log — picker, then Before vs After or Image + Notes.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Images, Loader2, Star, StickyNote, X } from 'lucide-react';
import {
  GOOD_HABIT_SUBOPTIONS,
  GOOD_HABIT_SUBTYPE,
} from '../domain/manualLogCategories';
import {
  GOOD_HABIT_IMAGE_MAX_DIMENSION_PX,
  GOOD_HABIT_IMAGE_TARGET_BYTES,
  GOOD_HABIT_NOTES_MAX_LEN,
} from '../../shared/constants/limits';
import { toStorageThumbnail } from '../../shared/utils/storageThumbnail';

const THUMB_OPTS = {
  targetBytes: GOOD_HABIT_IMAGE_TARGET_BYTES,
  maxDim: GOOD_HABIT_IMAGE_MAX_DIMENSION_PX,
};

const BTN =
  'flex w-full items-center gap-3 rounded-xl border-2 border-emerald-200/90 bg-gradient-to-b from-white to-emerald-50/70 px-4 py-3.5 text-left shadow-[0_3px_0_0_rgba(6,95,70,0.22)] transition-[transform,box-shadow] duration-150 active:translate-y-[2px] active:shadow-[0_1px_0_0_rgba(6,95,70,0.18)]';

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

function ImageSlot({ label, image, onPick, compressing }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/80">{label}</p>
      {image?.preview ? (
        <img src={image.preview} alt={`${label} preview`} className="h-28 w-full rounded-xl border border-emerald-200 object-cover" />
      ) : (
        <div className="flex h-28 w-full items-center justify-center rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 text-emerald-400">
          {compressing ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : <Images className="h-6 w-6" aria-hidden />}
        </div>
      )}
      <div className="flex w-full gap-1">
        <button type="button" onClick={() => cameraRef.current?.click()} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-700 py-1.5 text-[10px] font-bold text-white">
          <Camera className="h-3.5 w-3.5" aria-hidden /> Camera
        </button>
        <button type="button" onClick={() => galleryRef.current?.click()} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-200 py-1.5 text-[10px] font-bold text-emerald-800">
          <Images className="h-3.5 w-3.5" aria-hidden /> Gallery
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
    </div>
  );
}

function composeBeforeAfter(beforeSrc, afterSrc) {
  return new Promise((resolve) => {
    const before = new Image();
    const after = new Image();
    let loaded = 0;
    const tryDraw = () => {
      loaded += 1;
      if (loaded < 2) return;
      const cellW = 240;
      const cellH = 280;
      const canvas = document.createElement('canvas');
      canvas.width = cellW * 2 + 24;
      canvas.height = cellH + 36;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(afterSrc);
        return;
      }
      ctx.fillStyle = '#e8f5e9';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#064e3b';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Before', 12 + cellW / 2, 22);
      ctx.fillText('After', 12 + cellW + 12 + cellW / 2, 22);
      const drawFit = (img, x, y) => {
        const scale = Math.min(cellW / img.width, cellH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, x + (cellW - w) / 2, y + (cellH - h) / 2, w, h);
      };
      drawFit(before, 12, 32);
      drawFit(after, 12 + cellW + 12, 32);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    before.onload = tryDraw;
    after.onload = tryDraw;
    before.onerror = () => resolve(afterSrc);
    after.onerror = () => resolve(afterSrc);
    before.src = beforeSrc;
    after.src = afterSrc;
  });
}

export default function GoodHabitFlow({
  isOpen,
  onClose,
  onSave,
  capturedPreview = null,
}) {
  const [step, setStep] = useState('picker');
  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);
  const [single, setSingle] = useState(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [compressingSlot, setCompressingSlot] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    setStep('picker');
    setBefore(null);
    setAfter(capturedPreview ? { preview: capturedPreview, base64: capturedPreview } : null);
    setSingle(capturedPreview ? { preview: capturedPreview, base64: capturedPreview } : null);
    setNotes('');
    setSaving(false);
    setError(null);
    return undefined;
  }, [isOpen, capturedPreview]);

  const pickSlot = useCallback((setter, slotId) => async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setter({ preview, base64: null, compressing: true });
    setCompressingSlot(slotId);
    setError(null);
    try {
      const base64 = await compressPickedFile(file);
      setter({ preview: base64 || preview, base64, compressing: false });
    } catch (err) {
      URL.revokeObjectURL(preview);
      setter(null);
      setError(err?.message || 'Could not read that image.');
    } finally {
      setCompressingSlot(null);
    }
  }, []);

  if (!isOpen) return null;

  const remaining = Math.max(0, GOOD_HABIT_NOTES_MAX_LEN - notes.length);
  const busy = saving || Boolean(compressingSlot);

  const handleSaveBeforeAfter = async () => {
    if (!before?.base64 || !after?.base64) {
      setError('Upload both Before and After images.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const shareImage = await toStorageThumbnail(
        await composeBeforeAfter(before.preview, after.preview),
        THUMB_OPTS,
      );
      await onSave?.({
        habitType: GOOD_HABIT_SUBTYPE.BEFORE_AFTER,
        notes: notes.trim(),
        beforeImageBase64: before.base64,
        afterImageBase64: after.base64,
        imageBase64: after.base64,
        shareImage,
      });
    } catch (err) {
      setError(err?.message || "Couldn't save Good Habit.");
      setSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!single?.base64) {
      setError('Upload one image.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave?.({
        habitType: GOOD_HABIT_SUBTYPE.IMAGE_NOTES,
        notes: notes.trim(),
        imageBase64: single.base64,
        shareImage: single.base64,
      });
    } catch (err) {
      setError(err?.message || "Couldn't save Good Habit.");
      setSaving(false);
    }
  };

  const title = step === 'picker'
    ? 'Good Habit'
    : step === GOOD_HABIT_SUBTYPE.BEFORE_AFTER
      ? 'Before vs After'
      : 'Image + Notes';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="good-habit-title">
      <div className="flex w-full max-w-sm flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between px-4 pb-2 pt-4">
          <div>
            <p id="good-habit-title" className="text-sm font-bold leading-snug text-emerald-900">{title}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-emerald-700/70">
              {step === 'picker' ? 'Choose how to log this habit' : 'Any size photo — we compress it before saving'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex-shrink-0 rounded-xl p-1.5 hover:bg-emerald-50" aria-label="Close">
            <X className="h-4 w-4 text-emerald-600/60" />
          </button>
        </div>

        {error && (
          <p className="mx-4 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>
        )}

        {step === 'picker' && (
          <div className="flex flex-col gap-2.5 px-4 pb-4 pt-1">
            {GOOD_HABIT_SUBOPTIONS.map(({ id, label, hint }) => (
              <button key={id} type="button" onClick={() => { setError(null); setStep(id); }} className={BTN}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center text-emerald-700">
                  {id === GOOD_HABIT_SUBTYPE.BEFORE_AFTER
                    ? <Star className="h-6 w-6" strokeWidth={2.1} aria-hidden />
                    : <StickyNote className="h-6 w-6" strokeWidth={2.1} aria-hidden />}
                </span>
                <span>
                  <span className="block text-sm font-bold text-emerald-900">{label}</span>
                  <span className="block text-[11px] text-emerald-700/70">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {step === GOOD_HABIT_SUBTYPE.BEFORE_AFTER && (
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div className="flex gap-2">
              <ImageSlot label="Before" image={before} compressing={compressingSlot === 'before'} onPick={pickSlot(setBefore, 'before')} />
              <ImageSlot label="After" image={after} compressing={compressingSlot === 'after'} onPick={pickSlot(setAfter, 'after')} />
            </div>
            <label className="block">
              <span className="text-[11px] font-bold text-emerald-800">Notes (optional)</span>
              <textarea
                value={notes}
                maxLength={GOOD_HABIT_NOTES_MAX_LEN}
                onChange={(e) => setNotes(e.target.value.slice(0, GOOD_HABIT_NOTES_MAX_LEN))}
                rows={3}
                className="mt-1 w-full rounded-xl border border-emerald-200 px-3 py-2 text-sm text-emerald-950 outline-none focus:border-emerald-500"
                placeholder="What changed?"
              />
              <span className="mt-0.5 block text-right text-[10px] text-emerald-700/70">{remaining} left</span>
            </label>
            <button type="button" disabled={busy} onClick={handleSaveBeforeAfter} className={SAVE_BTN}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Save Good Habit
            </button>
            <button type="button" onClick={() => setStep('picker')} className="text-center text-xs font-semibold text-emerald-700">Back</button>
          </div>
        )}

        {step === GOOD_HABIT_SUBTYPE.IMAGE_NOTES && (
          <div className="flex flex-col gap-3 px-4 pb-4">
            <ImageSlot label="Image" image={single} compressing={compressingSlot === 'single'} onPick={pickSlot(setSingle, 'single')} />
            <label className="block">
              <span className="text-[11px] font-bold text-emerald-800">Notes</span>
              <textarea
                value={notes}
                maxLength={GOOD_HABIT_NOTES_MAX_LEN}
                onChange={(e) => setNotes(e.target.value.slice(0, GOOD_HABIT_NOTES_MAX_LEN))}
                rows={3}
                className="mt-1 w-full rounded-xl border border-emerald-200 px-3 py-2 text-sm text-emerald-950 outline-none focus:border-emerald-500"
                placeholder="Write a short note…"
              />
              <span className="mt-0.5 block text-right text-[10px] text-emerald-700/70">{remaining} left</span>
            </label>
            <button type="button" disabled={busy} onClick={handleSaveNotes} className={SAVE_BTN}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Save Good Habit
            </button>
            <button type="button" onClick={() => setStep('picker')} className="text-center text-xs font-semibold text-emerald-700">Back</button>
          </div>
        )}
      </div>
    </div>
  );
}
