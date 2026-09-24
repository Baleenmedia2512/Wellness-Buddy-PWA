/**
 * Portrait crop overlay — 9:16 frame with draggable corners.
 * Uses window-level pointer listeners so mobile WebViews track the corner reliably.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crop, RotateCcw, RotateCw } from 'lucide-react';
import {
  clampAspectCrop,
  containRect,
  cropBoxToPixels,
  initialAspectCrop,
  resizeAspectCropFromCorner,
} from '../../utils/portraitCropGeometry.js';

const HANDLE_HIT = 48;

function cornerPoint(crop, corner) {
  if (corner === 'nw') return { x: crop.x, y: crop.y };
  if (corner === 'ne') return { x: crop.x + crop.width, y: crop.y };
  if (corner === 'sw') return { x: crop.x, y: crop.y + crop.height };
  return { x: crop.x + crop.width, y: crop.y + crop.height };
}

function loadNaturalSize(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

async function rotateDataUrl90(src, direction) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to rotate image'));
    el.src = src;
  });
  const deg = direction < 0 ? -90 : 90;
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalHeight;
  canvas.height = img.naturalWidth;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  const out = canvas.toDataURL('image/jpeg', 0.92);
  canvas.width = 0;
  canvas.height = 0;
  return out;
}

function CornerHandle({ corner, onCornerDown }) {
  const isLeft = corner === 'nw' || corner === 'sw';
  const isTop = corner === 'nw' || corner === 'ne';
  return (
    <div
      data-handle={corner}
      role="slider"
      aria-label={`Resize ${corner} corner`}
      className="absolute z-30"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onCornerDown?.(corner, e);
      }}
      style={{
        width: HANDLE_HIT,
        height: HANDLE_HIT,
        left: isLeft ? -HANDLE_HIT / 2 : undefined,
        right: isLeft ? undefined : -HANDLE_HIT / 2,
        top: isTop ? -HANDLE_HIT / 2 : undefined,
        bottom: isTop ? undefined : -HANDLE_HIT / 2,
        touchAction: 'none',
        cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
      }}
    >
      <span
        className="absolute inset-0 m-auto rounded-full bg-white border-2 border-green-500 shadow-lg pointer-events-none"
        style={{ width: 20, height: 20 }}
        aria-hidden
      />
    </div>
  );
}

/**
 * @param {{
 *   rawImageSrc: string,
 *   aspect?: number,
 *   title?: string,
 *   hint?: string,
 *   zIndex?: number,
 *   onCancel: () => void,
 *   onDone: (pixelCrop: {x:number,y:number,width:number,height:number}, imageSrc: string) => void | Promise<void>,
 * }} props
 */
export default function PortraitCropOverlay({
  rawImageSrc,
  aspect = 9 / 16,
  title = 'Adjust photo',
  hint = 'Drag a green corner to resize · drag inside the box to move · keeps portrait 9:16',
  zIndex = 10050,
  onCancel,
  onDone,
}) {
  const viewportRef = useRef(null);
  const displayRef = useRef({ x: 0, y: 0, width: 0, height: 0, scale: 1 });
  const cropRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const dragRef = useRef(null);
  const aspectRef = useRef(aspect);
  aspectRef.current = aspect;

  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [display, setDisplay] = useState({ x: 0, y: 0, width: 0, height: 0, scale: 1 });
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [workingSrc, setWorkingSrc] = useState(rawImageSrc);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const updateCrop = useCallback((next) => {
    cropRef.current = next;
    setCrop(next);
  }, []);

  const updateDisplay = useCallback((next) => {
    displayRef.current = next;
    setDisplay(next);
  }, []);

  useEffect(() => {
    setWorkingSrc(rawImageSrc);
  }, [rawImageSrc]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Always clear window listeners on unmount.
  useEffect(() => () => {
    const drag = dragRef.current;
    if (drag?.onMove) window.removeEventListener('pointermove', drag.onMove);
    if (drag?.onUp) {
      window.removeEventListener('pointerup', drag.onUp);
      window.removeEventListener('pointercancel', drag.onUp);
    }
    dragRef.current = null;
  }, []);

  const layout = useCallback(() => {
    const el = viewportRef.current;
    if (!el || !(natural.width > 0) || !(natural.height > 0)) return;
    const rect = el.getBoundingClientRect();
    const nextDisplay = containRect(rect.width, rect.height, natural.width, natural.height);
    updateDisplay(nextDisplay);
    if (dragRef.current) return;
    const prev = cropRef.current;
    if (!(prev.width > 0)) {
      updateCrop(initialAspectCrop(nextDisplay, aspect));
      return;
    }
    updateCrop(clampAspectCrop(prev, nextDisplay, aspect));
  }, [natural, aspect, updateCrop, updateDisplay]);

  useEffect(() => {
    let cancelled = false;
    loadNaturalSize(workingSrc)
      .then((size) => {
        if (!cancelled) setNatural(size);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this photo.');
      });
    return () => { cancelled = true; };
  }, [workingSrc]);

  useEffect(() => {
    layout();
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', layout);
      return () => window.removeEventListener('resize', layout);
    }
    const ro = new ResizeObserver(() => layout());
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout]);

  const localPoint = (clientX, clientY) => {
    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport) return null;
    return {
      x: clientX - viewport.left,
      y: clientY - viewport.top,
    };
  };

  const stopWindowDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.onMove) window.removeEventListener('pointermove', drag.onMove);
    if (drag.onUp) {
      window.removeEventListener('pointerup', drag.onUp);
      window.removeEventListener('pointercancel', drag.onUp);
    }
    dragRef.current = null;
  };

  const startWindowDrag = (dragState) => {
    stopWindowDrag();

    const onMove = (ev) => {
      ev.preventDefault();
      const displayNow = displayRef.current;
      const a = aspectRef.current;

      if (dragState.mode === 'move') {
        const dx = ev.clientX - dragState.startX;
        const dy = ev.clientY - dragState.startY;
        updateCrop(clampAspectCrop({
          ...dragState.origin,
          x: dragState.origin.x + dx,
          y: dragState.origin.y + dy,
        }, displayNow, a));
        return;
      }

      const local = localPoint(ev.clientX, ev.clientY);
      if (!local) return;
      const cornerX = local.x - dragState.grabOffsetX;
      const cornerY = local.y - dragState.grabOffsetY;
      updateCrop(resizeAspectCropFromCorner(
        dragState.origin,
        dragState.mode,
        cornerX,
        cornerY,
        displayNow,
        a,
      ));
    };

    const onUp = () => {
      stopWindowDrag();
    };

    dragState.onMove = onMove;
    dragState.onUp = onUp;
    dragRef.current = dragState;
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const beginCornerDrag = (corner, e) => {
    if (busy) return;
    const origin = { ...cropRef.current };
    const local = localPoint(e.clientX, e.clientY);
    const cornerPos = cornerPoint(origin, corner);
    startWindowDrag({
      mode: corner,
      startX: e.clientX,
      startY: e.clientY,
      origin,
      grabOffsetX: local ? local.x - cornerPos.x : 0,
      grabOffsetY: local ? local.y - cornerPos.y : 0,
    });
  };

  const onBoxPointerDown = (e) => {
    if (busy) return;
    if (e.target?.closest?.('[data-handle]')) return;
    e.preventDefault();
    e.stopPropagation();
    startWindowDrag({
      mode: 'move',
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...cropRef.current },
      grabOffsetX: 0,
      grabOffsetY: 0,
    });
  };

  const handleReset = () => {
    updateCrop(initialAspectCrop(displayRef.current, aspect));
  };

  const handleRotate = async (direction) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await rotateDataUrl90(workingSrc, direction);
      setWorkingSrc(next);
      updateCrop({ x: 0, y: 0, width: 0, height: 0 });
    } catch (err) {
      setError(err?.message || 'Could not rotate photo.');
    } finally {
      setBusy(false);
    }
  };

  const handleDone = async () => {
    if (busy || !(crop.width > 0)) return;
    setBusy(true);
    setError(null);
    try {
      const pixels = cropBoxToPixels(crop, display, natural.width, natural.height);
      await onDone(pixels, workingSrc);
    } catch (err) {
      setError(err?.message || 'Could not crop photo.');
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col bg-black overflow-hidden"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-label="Crop photo"
    >
      <header
        className="flex-shrink-0 flex items-center justify-between px-4 bg-black/95 border-b border-white/10"
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          paddingBottom: '12px',
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-white/70 hover:text-white text-sm font-medium px-3 py-1.5 rounded-lg border border-white/20 disabled:opacity-50"
        >
          Cancel
        </button>
        <span className="text-white font-semibold text-base tracking-wide">{title}</span>
        <button
          type="button"
          onClick={handleDone}
          disabled={busy || !(crop.width > 0)}
          className="text-white text-sm font-semibold px-4 py-1.5 rounded-lg bg-green-500 hover:bg-green-400 disabled:opacity-50"
        >
          {busy ? '…' : 'Done'}
        </button>
      </header>

      <div
        ref={viewportRef}
        className="relative flex-1 min-h-0 w-full overflow-hidden bg-[#111] touch-none select-none"
      >
        {workingSrc ? (
          <img
            src={workingSrc}
            alt=""
            draggable={false}
            className="absolute pointer-events-none select-none"
            style={{
              left: display.x,
              top: display.y,
              width: display.width,
              height: display.height,
            }}
          />
        ) : null}

        {crop.width > 0 ? (
          <div
            data-crop-box
            className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
            onPointerDown={onBoxPointerDown}
            style={{
              left: crop.x,
              top: crop.y,
              width: crop.width,
              height: crop.height,
              touchAction: 'none',
              cursor: 'move',
            }}
          >
            <div className="absolute inset-0 pointer-events-none" aria-hidden>
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/35" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/35" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/35" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/35" />
            </div>
            <CornerHandle corner="nw" onCornerDown={beginCornerDrag} />
            <CornerHandle corner="ne" onCornerDown={beginCornerDrag} />
            <CornerHandle corner="sw" onCornerDown={beginCornerDrag} />
            <CornerHandle corner="se" onCornerDown={beginCornerDrag} />
          </div>
        ) : null}
      </div>

      <footer
        className="flex-shrink-0 bg-black/95 px-4 pt-3 border-t border-white/10 space-y-3"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        {hint ? (
          <p className="text-center text-white/55 text-xs">{hint}</p>
        ) : null}
        {error ? (
          <p className="text-center text-red-400 text-xs">{error}</p>
        ) : null}
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() => handleRotate(-1)}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl bg-white/10 active:bg-white/25 border border-white/10 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4 text-white" aria-hidden="true" />
            <span className="text-white/80 text-xs font-medium">-90°</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={busy || !(display.width > 0)}
            className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl bg-green-500/20 active:bg-green-500/40 border border-green-500/30 disabled:opacity-50"
          >
            <Crop className="w-4 h-4 text-green-400" aria-hidden="true" />
            <span className="text-green-300 text-xs font-medium">Reset</span>
          </button>
          <button
            type="button"
            onClick={() => handleRotate(1)}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl bg-white/10 active:bg-white/25 border border-white/10 disabled:opacity-50"
          >
            <RotateCw className="w-4 h-4 text-white" aria-hidden="true" />
            <span className="text-white/80 text-xs font-medium">+90°</span>
          </button>
        </div>
      </footer>
    </div>,
    document.body,
  );
}
