// Full-screen profile photo cropper — fixed header/footer, crop-only middle zone.
// Portal + position:fixed so Cancel/Done never scroll away inside onboarding modals.
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import { Crop, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';

const CropOverlay = ({
  rawImageSrc, crop, zoom, rotation,
  setCrop, setZoom, setRotation, onCropComplete,
  onCancel, onDone, zIndex = 60,
}) => {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

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
        <span className="text-white font-semibold text-base tracking-wide">Crop Photo</span>
        <button
          type="button"
          onClick={onDone}
          className="text-white text-sm font-semibold px-4 py-1.5 rounded-lg bg-green-500 hover:bg-green-400"
        >
          Done
        </button>
      </header>

      {/* MIDDLE — crop viewport; pinch/drag only inside this zone */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden">
        <div className="absolute inset-0">
          <Cropper
            image={rawImageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            style={{ containerStyle: { background: '#111' } }}
          />
        </div>
      </div>

      {/* BOTTOM — fixed controls; never scrolls */}
      <footer
        className="flex-shrink-0 bg-black/95 px-4 pt-3 border-t border-white/10 space-y-3"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
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
            onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0); }}
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
