// Full-screen profile photo cropper — fixed header/footer, crop-only middle zone.
// Portal + position:fixed so Cancel/Done never scroll away inside onboarding modals.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { Crop, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';

const CROP_PAD = 16;
const MIN_CROP_SIDE = 96;

const CORNERS = [
  { id: 'nw', sx: -1, sy: -1, left: '0%', top: '0%', cursor: 'nwse-resize' },
  { id: 'ne', sx: 1, sy: -1, left: '100%', top: '0%', cursor: 'nesw-resize' },
  { id: 'sw', sx: -1, sy: 1, left: '0%', top: '100%', cursor: 'nesw-resize' },
  { id: 'se', sx: 1, sy: 1, left: '100%', top: '100%', cursor: 'nwse-resize' },
];

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function maxCropSize(container, aspect) {
  const maxW = Math.max(0, container.width - CROP_PAD * 2);
  const maxH = Math.max(0, container.height - CROP_PAD * 2);
  if (maxW <= 0 || maxH <= 0 || !(aspect > 0)) return null;
  if (maxW / maxH > aspect) {
    return { width: maxH * aspect, height: maxH };
  }
  return { width: maxW, height: maxW / aspect };
}

function defaultCropSize(container, aspect) {
  const max = maxCropSize(container, aspect);
  if (!max) return null;
  return {
    width: max.width * 0.92,
    height: max.height * 0.92,
  };
}

function sizeFromCornerDrag(start, dx, dy, corner, aspect, container) {
  const max = maxCropSize(container, aspect);
  if (!max) return start;

  const fromW = start.width + dx * corner.sx;
  const fromH = (start.height + dy * corner.sy) * aspect;
  // Prefer the axis the finger moved more (in width-space).
  const widthDelta = Math.abs(dx);
  const heightDelta = Math.abs(dy) * aspect;
  const nextW = widthDelta >= heightDelta ? fromW : fromH;

  const minW = Math.min(MIN_CROP_SIDE, max.width);
  const minH = Math.min(MIN_CROP_SIDE / aspect, max.height);
  const minWidth = Math.max(minW, minH * aspect);
  const width = clamp(nextW, minWidth, max.width);
  return { width, height: width / aspect };
}

const CropOverlay = ({
  rawImageSrc, crop, zoom, rotation,
  setCrop, setZoom, setRotation, onCropComplete,
  onCancel, onDone, zIndex = 60,
  aspect = 1,
  cropShape = 'round',
  title = 'Crop Photo',
  hint = '',
  objectFit = 'contain',
  /** When true, show corner dots to resize the crop frame (aspect locked). */
  resizable = false,
}) => {
  const viewportRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [cropSize, setCropSize] = useState(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    if (!resizable) {
      setCropSize(null);
      return undefined;
    }
    const el = viewportRef.current;
    if (!el) return undefined;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const next = { width: rect.width, height: rect.height };
      setContainerSize(next);
      setCropSize((prev) => {
        const max = maxCropSize(next, aspect);
        if (!max) return prev;
        if (!prev) return defaultCropSize(next, aspect);
        const width = clamp(prev.width, Math.min(MIN_CROP_SIDE, max.width), max.width);
        return { width, height: width / aspect };
      });
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [resizable, aspect]);

  const onHandlePointerDown = useCallback((corner, event) => {
    if (!cropSize || !resizable) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    target.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      corner,
      startX: event.clientX,
      startY: event.clientY,
      startSize: cropSize,
    };
  }, [cropSize, resizable]);

  const onHandlePointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setCropSize(sizeFromCornerDrag(
      drag.startSize,
      dx,
      dy,
      drag.corner,
      aspect,
      containerSize,
    ));
  }, [aspect, containerSize]);

  const onHandlePointerUp = useCallback((event) => {
    if (!dragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
  }, []);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    if (resizable) {
      setCropSize(defaultCropSize(containerSize, aspect));
    }
  };

  const frameLeft = cropSize
    ? (containerSize.width - cropSize.width) / 2
    : 0;
  const frameTop = cropSize
    ? (containerSize.height - cropSize.height) / 2
    : 0;

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col bg-black overflow-hidden"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-label="Crop photo"
    >
      {/* TOP — fixed header; never scrolls */}
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
          className="text-white/70 hover:text-white text-sm font-medium px-3 py-1.5 rounded-lg border border-white/20"
        >
          Cancel
        </button>
        <span className="text-white font-semibold text-base tracking-wide">{title}</span>
        <button
          type="button"
          onClick={onDone}
          className="text-white text-sm font-semibold px-4 py-1.5 rounded-lg bg-green-500 hover:bg-green-400"
        >
          Done
        </button>
      </header>

      {/* MIDDLE — crop viewport; pinch/drag only inside this zone */}
      <div ref={viewportRef} className="relative flex-1 min-h-0 w-full overflow-hidden">
        {(!resizable || cropSize) ? (
          <div className="absolute inset-0">
            <Cropper
              image={rawImageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              cropShape={cropShape}
              cropSize={resizable ? cropSize : undefined}
              objectFit={objectFit}
              showGrid
              restrictPosition
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              style={{ containerStyle: { background: '#111' } }}
            />
          </div>
        ) : null}

        {resizable && cropSize ? (
          <div
            className="absolute pointer-events-none"
            style={{
              left: frameLeft,
              top: frameTop,
              width: cropSize.width,
              height: cropSize.height,
            }}
            aria-hidden="true"
          >
            {CORNERS.map((corner) => (
              <button
                key={corner.id}
                type="button"
                aria-label={`Resize crop ${corner.id}`}
                className="absolute pointer-events-auto z-10 -translate-x-1/2 -translate-y-1/2 touch-none"
                style={{
                  left: corner.left,
                  top: corner.top,
                  width: 44,
                  height: 44,
                  cursor: corner.cursor,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                }}
                onPointerDown={(e) => onHandlePointerDown(corner, e)}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp}
                onPointerCancel={onHandlePointerUp}
              >
                <span
                  className="absolute left-1/2 top-1/2 block h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-green-500 shadow"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* BOTTOM — fixed controls; never scrolls */}
      <footer
        className="flex-shrink-0 bg-black/95 px-4 pt-3 border-t border-white/10 space-y-3"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        {hint ? (
          <p className="text-center text-white/55 text-xs">{hint}</p>
        ) : null}
        <div className="flex items-center gap-2">
          <ZoomOut className="w-4 h-4 text-white/60 flex-shrink-0" aria-hidden="true" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.02}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 h-2 accent-green-500"
            aria-label="Zoom"
          />
          <ZoomIn className="w-4 h-4 text-white/60 flex-shrink-0" aria-hidden="true" />
          <span className="text-white/40 text-xs w-8 text-right flex-shrink-0">{zoom.toFixed(1)}x</span>
        </div>
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-white/60 flex-shrink-0" aria-hidden="true" />
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            className="flex-1 h-2 accent-green-500"
            aria-label="Rotation"
          />
          <RotateCw className="w-4 h-4 text-white/60 flex-shrink-0" aria-hidden="true" />
          <span className="text-white/40 text-xs w-8 text-right flex-shrink-0">{rotation}°</span>
        </div>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() => setRotation((r) => r - 90)}
            className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl bg-white/10 active:bg-white/25 border border-white/10"
          >
            <RotateCcw className="w-4 h-4 text-white" aria-hidden="true" />
            <span className="text-white/80 text-xs font-medium">-90°</span>
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl bg-green-500/20 active:bg-green-500/40 border border-green-500/30"
          >
            <Crop className="w-4 h-4 text-green-400" aria-hidden="true" />
            <span className="text-green-300 text-xs font-medium">Reset</span>
          </button>
          <button
            type="button"
            onClick={() => setRotation((r) => r + 90)}
            className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl bg-white/10 active:bg-white/25 border border-white/10"
          >
            <RotateCw className="w-4 h-4 text-white" aria-hidden="true" />
            <span className="text-white/80 text-xs font-medium">+90°</span>
          </button>
        </div>
      </footer>
    </div>,
    document.body,
  );
};

export default CropOverlay;
