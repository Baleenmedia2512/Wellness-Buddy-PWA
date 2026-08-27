/**
 * Full-screen guided capture: separate screen per Front / Left / Right pose.
 * On-device MediaPipe face + pose (no Gemini).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, CheckCircle2, SkipForward, X } from 'lucide-react';
import {
  POSE_STEPS,
  POSE_STEP_COPY,
  evaluatePoseGuidance,
} from '../../domain/poseGuidance.rules.js';
import {
  analyzePoseFrame,
  warmPoseGuidanceModels,
} from '../../services/onDevicePoseGuidance.js';

const SilhouetteHint = ({ pose }) => {
  // Simple CSS silhouette cue — left/right mirror for side poses.
  const side = pose === 'left' ? 'scale-x-100' : pose === 'right' ? '-scale-x-100' : 'scale-x-100';
  const isFront = pose === 'front';
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-end justify-center pb-8 opacity-40 ${side}`}
      aria-hidden
    >
      <svg viewBox="0 0 120 220" className="h-[70%] max-h-[420px] w-auto text-white drop-shadow">
        {isFront ? (
          <>
            <ellipse cx="60" cy="28" rx="18" ry="22" fill="currentColor" opacity="0.85" />
            <path
              d="M40 55 Q60 48 80 55 L92 120 Q60 135 28 120 Z"
              fill="currentColor"
              opacity="0.75"
            />
            <rect x="42" y="118" width="14" height="70" rx="6" fill="currentColor" opacity="0.7" />
            <rect x="64" y="118" width="14" height="70" rx="6" fill="currentColor" opacity="0.7" />
          </>
        ) : (
          <>
            <ellipse cx="68" cy="28" rx="14" ry="22" fill="currentColor" opacity="0.85" />
            <path
              d="M55 52 L78 58 L82 125 L58 130 L48 70 Z"
              fill="currentColor"
              opacity="0.75"
            />
            <rect x="58" y="125" width="16" height="70" rx="6" fill="currentColor" opacity="0.7" />
          </>
        )}
      </svg>
    </div>
  );
};

/**
 * @param {{
 *   open: boolean,
 *   startStep?: 'front'|'left'|'right',
 *   existingPreviews?: { front?: string|null, left?: string|null, right?: string|null },
 *   onComplete: (slots: { front?: string, left?: string, right?: string }) => void,
 *   onClose: () => void,
 * }} props
 */
export default function GuidedTransformationCapture({
  open,
  startStep = 'front',
  existingPreviews = {},
  onComplete,
  onClose,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);

  const [stepIndex, setStepIndex] = useState(() => Math.max(0, POSE_STEPS.indexOf(startStep)));
  const [ready, setReady] = useState(false);
  const [modelError, setModelError] = useState(null);
  const [guidance, setGuidance] = useState({ ok: false, message: 'Starting camera…' });
  const [captured, setCaptured] = useState(() => ({
    front: existingPreviews.front || null,
    left: existingPreviews.left || null,
    right: existingPreviews.right || null,
  }));
  const [capturing, setCapturing] = useState(false);

  const step = POSE_STEPS[stepIndex] || 'front';
  const copy = POSE_STEP_COPY[step];

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setModelError(null);
    setReady(false);
    setStepIndex(Math.max(0, POSE_STEPS.indexOf(startStep)));

    (async () => {
      try {
        await warmPoseGuidanceModels();
        if (cancelled) return;
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: 'user',
            width: { ideal: 720 },
            height: { ideal: 1280 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setModelError(err?.message || 'Camera or pose models unavailable.');
        }
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, startStep, stopCamera]);

  useEffect(() => {
    if (!open || !ready) return undefined;
    let alive = true;

    const tick = async (ts) => {
      if (!alive) return;
      rafRef.current = requestAnimationFrame(tick);
      if (ts - lastTsRef.current < 180) return;
      lastTsRef.current = ts;
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      try {
        const sample = await analyzePoseFrame(video, ts);
        if (!alive) return;
        setGuidance(evaluatePoseGuidance(step, sample));
      } catch {
        if (alive) {
          setGuidance({
            ok: false,
            code: 'error',
            message: 'Pose check paused — keep your full body in frame.',
          });
        }
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [open, ready, step]);

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || capturing) return;
    setCapturing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 1280;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not capture frame');
      // Mirror selfie preview → un-mirror for storage.
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const nextCaptured = { ...captured, [step]: dataUrl };
      setCaptured(nextCaptured);

      if (stepIndex < POSE_STEPS.length - 1) {
        setStepIndex((i) => i + 1);
        setGuidance({ ok: false, message: 'Next pose — follow the on-screen guide.' });
      } else {
        stopCamera();
        onComplete?.(nextCaptured);
      }
    } catch (err) {
      setGuidance({
        ok: false,
        code: 'capture_error',
        message: err?.message || 'Capture failed. Try again.',
      });
    } finally {
      setCapturing(false);
    }
  }, [captured, capturing, onComplete, step, stepIndex, stopCamera]);

  const skipStep = useCallback(() => {
    if (stepIndex < POSE_STEPS.length - 1) {
      setStepIndex((i) => i + 1);
      setGuidance({ ok: false, message: 'Skipped — next pose.' });
      return;
    }
    stopCamera();
    onComplete?.(captured);
  }, [captured, onComplete, stepIndex, stopCamera]);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose?.();
  }, [onClose, stopCamera]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black text-white flex flex-col">
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' }}
      >
        <button type="button" onClick={handleClose} className="p-2 rounded-full bg-white/10" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold">{copy.title}</p>
          <p className="text-[11px] text-white/70">
            Step {stepIndex + 1} of {POSE_STEPS.length} · on-device guide (no Gemini)
          </p>
        </div>
        <button type="button" onClick={skipStep} className="p-2 rounded-full bg-white/10" aria-label="Skip">
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 bg-black overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        <SilhouetteHint pose={step} />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />
      </div>

      <div
        className="px-4 pt-3 pb-5 space-y-3 bg-gray-950"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}
      >
        <p className="text-sm text-center text-white/90">{copy.instruction}</p>
        {modelError ? (
          <p className="text-sm text-center text-amber-300">{modelError}</p>
        ) : (
          <p className={`text-sm text-center font-medium ${guidance.ok ? 'text-emerald-300' : 'text-amber-200'}`}>
            {guidance.message}
          </p>
        )}

        <div className="flex gap-2 justify-center">
          {POSE_STEPS.map((key, i) => (
            <span
              key={key}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                i === stepIndex
                  ? 'bg-emerald-500 text-white'
                  : captured[key]
                    ? 'bg-white/20 text-white'
                    : 'bg-white/10 text-white/60'
              }`}
            >
              {captured[key] ? <CheckCircle2 className="w-3 h-3" /> : null}
              {POSE_STEP_COPY[key].title.replace(' pose', '')}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            className="py-3 rounded-xl bg-white/10 font-semibold disabled:opacity-40 flex items-center justify-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button
            type="button"
            onClick={captureFrame}
            disabled={!ready || capturing || (!guidance.ok && !modelError)}
            className="py-3 rounded-xl bg-emerald-500 font-bold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            {capturing ? 'Saving…' : guidance.ok ? 'Capture' : 'Align pose'}
          </button>
        </div>
        {modelError ? (
          <button
            type="button"
            onClick={captureFrame}
            disabled={!ready || capturing}
            className="w-full py-2.5 rounded-xl border border-white/30 text-sm font-semibold"
          >
            Capture without pose check
          </button>
        ) : null}
      </div>
    </div>
  );
}
