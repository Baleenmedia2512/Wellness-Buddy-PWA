// Reusable cropper overlay with zoom/rotation/reset and Cancel/Done bar.
// Driven by useImageCropper hook state passed in via props.
import React from 'react';
import Cropper from 'react-easy-crop';
import { Crop, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';

const CropOverlay = ({
  rawImageSrc, crop, zoom, rotation,
  setCrop, setZoom, setRotation, onCropComplete,
  onCancel, onDone, zIndex = 60,
}) => (
  <div className="absolute inset-0 flex flex-col bg-black" style={{ zIndex }}>
    <div className="flex items-center justify-between px-5 py-4 bg-black/90">
      <button onClick={onCancel} className="text-white/70 hover:text-white text-sm font-medium px-3 py-1.5 rounded-lg border border-white/20">Cancel</button>
      <span className="text-white font-semibold text-base tracking-wide">Crop Photo</span>
      <button onClick={onDone} className="text-white text-sm font-semibold px-4 py-1.5 rounded-lg bg-green-500 hover:bg-green-400">Done</button>
    </div>
    <div className="relative flex-1">
      <Cropper
        image={rawImageSrc}
        crop={crop} zoom={zoom} rotation={rotation}
        aspect={1} cropShape="round" showGrid
        onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation}
        onCropComplete={onCropComplete}
        style={{ containerStyle: { background: '#111' } }}
      />
    </div>
    <div className="bg-black/90 px-4 pt-3 pb-6 space-y-3" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
      <div className="flex items-center gap-2">
        <ZoomOut className="w-4 h-4 text-white/60 flex-shrink-0" />
        <input type="range" min={1} max={3} step={0.02} value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 h-2 accent-green-500" />
        <ZoomIn className="w-4 h-4 text-white/60 flex-shrink-0" />
        <span className="text-white/40 text-xs w-8 text-right flex-shrink-0">{zoom.toFixed(1)}x</span>
      </div>
      <div className="flex items-center gap-2">
        <RotateCcw className="w-4 h-4 text-white/60 flex-shrink-0" />
        <input type="range" min={-180} max={180} step={1} value={rotation}
          onChange={(e) => setRotation(Number(e.target.value))} className="flex-1 h-2 accent-green-500" />
        <RotateCw className="w-4 h-4 text-white/60 flex-shrink-0" />
        <span className="text-white/40 text-xs w-8 text-right flex-shrink-0">{rotation}°</span>
      </div>
      <div className="flex justify-center gap-2">
        <button onClick={() => setRotation((r) => r - 90)}
          className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl bg-white/10 active:bg-white/25 border border-white/10">
          <RotateCcw className="w-4 h-4 text-white" />
          <span className="text-white/80 text-xs font-medium">-90°</span>
        </button>
        <button onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0); }}
          className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl bg-green-500/20 active:bg-green-500/40 border border-green-500/30">
          <Crop className="w-4 h-4 text-green-400" />
          <span className="text-green-300 text-xs font-medium">Reset</span>
        </button>
        <button onClick={() => setRotation((r) => r + 90)}
          className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl bg-white/10 active:bg-white/25 border border-white/10">
          <RotateCw className="w-4 h-4 text-white" />
          <span className="text-white/80 text-xs font-medium">+90°</span>
        </button>
      </div>
    </div>
  </div>
);

export default CropOverlay;
