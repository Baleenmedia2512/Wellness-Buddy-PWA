/**
 * Free crop — each corner moves independently (quadrilateral / perspective crop).
 * Edge midpoints move a whole side. Done warps the quad into a rectangle.
 */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crop, RotateCcw, RotateCw } from 'lucide-react';
import {
  clampQuad,
  containRect,
  initialQuad,
  midpoints,
  moveCorner,
  moveEdge,
  moveQuad,
  quadPointsAttr,
  quadToNaturalPixels,
} from '../../utils/freeQuadGeometry.js';
import { warpQuadToDataUrl } from '../../services/warpQuadImage.js';

const HANDLE_HIT = 44;

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

function Handle({ x, y, label, onDown }) {
  return (
    <div
      role="slider"
      aria-label={label}
      className="absolute z-30"
      onPointerDown={onDown}
      style={{
        left: x - HANDLE_HIT / 2,
        top: y - HANDLE_HIT / 2,
        width: HANDLE_HIT,
        height: HANDLE_HIT,
        touchAction: 'none',
        cursor: 'grab',
      }}
    >
      <span
        className="absolute inset-0 m-auto rounded-full bg-white border-2 border-green-500 shadow-lg pointer-events-none"
        style={{ width: 18, height: 18 }}
        aria-hidden
      />
    </div>
  );
}

/**
 * @param {{
 *   rawImageSrc: string,
 *   title?: string,
 *   hint?: string,
 *   zIndex?: number,
 *   onCancel: () => void,
 *   onDone: (dataUrl: string) => void | Promise<void>,
 * }} props
 */
export default function FreeQuadCropOverlay({
  rawImageSrc,
  title = 'Adjust photo',
  hint = 'Drag any corner freely · edge dots move a side · drag inside to move all',
  zIndex = 10050,
  onCancel,
  onDone,
}) {
  const maskId = useId().replace(/:/g, '');
  const viewportRef = useRef(null);
  const displayRef = useRef({ x: 0, y: 0, width: 0, height: 0, scale: 1 });
  const quadRef = useRef(null);
  const dragRef = useRef(null);

  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [display, setDisplay] = useState({ x: 0, y: 0, width: 0, height: 0, scale: 1 });
  const [quad, setQuad] = useState(null);
  const [workingSrc, setWorkingSrc] = useState(rawImageSrc);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const updateQuad = useCallback((next) => {
    quadRef.current = next;
    setQuad(next);
  }, []);

  const updateDisplay = useCallback((next) => {
    displayRef.current = next;
    setDisplay(next);
  }, []);

  useEffect(() => {
    setWorkingSrc(rawImageSrc);
  }, [rawImageSrc]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

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
    if (!quadRef.current) {
      updateQuad(initialQuad(nextDisplay));
      return;
    }
    updateQuad(clampQuad(quadRef.current, nextDisplay));
  }, [natural, updateDisplay, updateQuad]);

  useEffect(() => {
    let cancelled = false;
    loadNaturalSize(workingSrc)
      .then((size) => { if (!cancelled) setNatural(size); })
      .catch(() => { if (!cancelled) setError('Could not load this photo.'); });
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

  const stopDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.onMove) window.removeEventListener('pointermove', drag.onMove);
    if (drag.onUp) {
      window.removeEventListener('pointerup', drag.onUp);
      window.removeEventListener('pointercancel', drag.onUp);
    }
    dragRef.current = null;
  };

  const startDrag = (state) => {
    stopDrag();
    const onMove = (ev) => {
      ev.preventDefault();
      const displayNow = displayRef.current;
      const origin = state.origin;
      const dx = ev.clientX - state.startX;
      const dy = ev.clientY - state.startY;

      if (state.mode === 'move') {
        updateQuad(moveQuad(origin, dx, dy, displayNow));
        return;
      }
      if (state.mode === 'edge') {
        updateQuad(moveEdge(origin, state.edge, dx, dy, displayNow));
        return;
      }
      if (state.mode === 'corner') {
        const viewport = viewportRef.current?.getBoundingClientRect();
        if (!viewport) return;
        const point = {
          x: ev.clientX - viewport.left - state.grabOffsetX,
          y: ev.clientY - viewport.top - state.grabOffsetY,
        };
        updateQuad(moveCorner(origin, state.corner, point, displayNow));
      }
    };
    const onUp = () => stopDrag();
    state.onMove = onMove;
    state.onUp = onUp;
    dragRef.current = state;
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const onCornerDown = (corner, e) => {
    if (busy || !quadRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport) return;
    const pt = quadRef.current[corner];
    startDrag({
      mode: 'corner',
      corner,
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...quadRef.current, tl: { ...quadRef.current.tl }, tr: { ...quadRef.current.tr }, br: { ...quadRef.current.br }, bl: { ...quadRef.current.bl } },
      grabOffsetX: (e.clientX - viewport.left) - pt.x,
      grabOffsetY: (e.clientY - viewport.top) - pt.y,
    });
  };

  const onEdgeDown = (edge, e) => {
    if (busy || !quadRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    startDrag({
      mode: 'edge',
      edge,
      startX: e.clientX,
      startY: e.clientY,
      origin: {
        tl: { ...quadRef.current.tl },
        tr: { ...quadRef.current.tr },
        br: { ...quadRef.current.br },
        bl: { ...quadRef.current.bl },
      },
    });
  };

  const onInsideDown = (e) => {
    if (busy || !quadRef.current) return;
    if (e.target?.closest?.('[data-handle]')) return;
    e.preventDefault();
    e.stopPropagation();
    startDrag({
      mode: 'move',
      startX: e.clientX,
      startY: e.clientY,
      origin: {
        tl: { ...quadRef.current.tl },
        tr: { ...quadRef.current.tr },
        br: { ...quadRef.current.br },
        bl: { ...quadRef.current.bl },
      },
    });
  };

  const handleReset = () => {
    updateQuad(initialQuad(displayRef.current));
  };

  const handleRotate = async (direction) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await rotateDataUrl90(workingSrc, direction);
      setWorkingSrc(next);
      updateQuad(null);
      quadRef.current = null;
    } catch (err) {
      setError(err?.message || 'Could not rotate photo.');
    } finally {
      setBusy(false);
    }
  };

  const handleDone = async () => {
    if (busy || !quad) return;
    setBusy(true);
    setError(null);
    try {
      // Paint "Saving…" before canvas work so the tap doesn't look dead.
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });

      if (!(natural.width > 0) || !(natural.height > 0)) {
        throw new Error('Photo is still loading — wait a moment and tap Done again');
      }
      if (!(display.width > 0) || !(display.height > 0)) {
        throw new Error('Crop view is not ready — tap Reset, then Done');
      }

      const naturalQuad = quadToNaturalPixels(quad, display, natural.width, natural.height);
      if (!naturalQuad) {
        throw new Error('Could not read crop area — tap Reset and try again');
      }

      const dataUrl = await warpQuadToDataUrl(
        workingSrc,
        naturalQuad,
        0,
        0,
        { maxDimension: 1200, targetBytes: 900 * 1024, startQuality: 0.85 },
      );

      await onDone(dataUrl);
    } catch (err) {
      // eslint-disable-next-line no-console -- crop save failures need device logs
      console.error('[free-crop] Done failed:', err);
      setError(err?.message || 'Could not save crop. Please try again.');
      setBusy(false);
    }
  };

  const mids = quad ? midpoints(quad) : null;

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col bg-black overflow-hidden"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-label="Free crop photo"
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
          disabled={busy || !quad}
          className="text-white text-sm font-semibold px-4 py-1.5 rounded-lg bg-green-500 hover:bg-green-400 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Done'}
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

        {quad ? (
          <>
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              aria-hidden
            >
              <defs>
                <mask id={maskId}>
                  <rect width="100%" height="100%" fill="white" />
                  <polygon points={quadPointsAttr(quad)} fill="black" />
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="rgba(0,0,0,0.55)"
                mask={`url(#${maskId})`}
              />
              <polygon
                points={quadPointsAttr(quad)}
                fill="transparent"
                stroke="white"
                strokeWidth="2"
                className="pointer-events-auto"
                style={{ cursor: 'move', touchAction: 'none' }}
                onPointerDown={onInsideDown}
              />
            </svg>

            <div data-handle="tl"><Handle x={quad.tl.x} y={quad.tl.y} label="Top-left corner" onDown={(e) => onCornerDown('tl', e)} /></div>
            <div data-handle="tr"><Handle x={quad.tr.x} y={quad.tr.y} label="Top-right corner" onDown={(e) => onCornerDown('tr', e)} /></div>
            <div data-handle="br"><Handle x={quad.br.x} y={quad.br.y} label="Bottom-right corner" onDown={(e) => onCornerDown('br', e)} /></div>
            <div data-handle="bl"><Handle x={quad.bl.x} y={quad.bl.y} label="Bottom-left corner" onDown={(e) => onCornerDown('bl', e)} /></div>

            {mids ? (
              <>
                <div data-handle="top"><Handle x={mids.top.x} y={mids.top.y} label="Top edge" onDown={(e) => onEdgeDown('top', e)} /></div>
                <div data-handle="right"><Handle x={mids.right.x} y={mids.right.y} label="Right edge" onDown={(e) => onEdgeDown('right', e)} /></div>
                <div data-handle="bottom"><Handle x={mids.bottom.x} y={mids.bottom.y} label="Bottom edge" onDown={(e) => onEdgeDown('bottom', e)} /></div>
                <div data-handle="left"><Handle x={mids.left.x} y={mids.left.y} label="Left edge" onDown={(e) => onEdgeDown('left', e)} /></div>
              </>
            ) : null}
          </>
        ) : null}
      </div>

      <footer
        className="flex-shrink-0 bg-black/95 px-4 pt-3 border-t border-white/10 space-y-3"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        {hint ? <p className="text-center text-white/55 text-xs">{hint}</p> : null}
        {error ? <p className="text-center text-red-400 text-xs">{error}</p> : null}
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
