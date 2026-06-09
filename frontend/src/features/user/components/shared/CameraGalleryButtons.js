// Two-button camera/gallery picker used by profile-picture flows.
import React from 'react';
import { Camera, Upload } from 'lucide-react';

const CameraGalleryButtons = ({ onCameraSelect, onGallerySelect, disabled, layout = 'wide' }) => {
  const cameraRef = React.useRef(null);
  const galleryRef = React.useRef(null);
  const baseBtn = layout === 'compact'
    ? 'flex flex-col items-center gap-2 py-4 border-2 rounded-xl font-semibold text-sm transition-all'
    : 'flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  return (
    <div className="flex justify-center">
      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
      <input ref={cameraRef} type="file" accept="image/*" capture="user"
        onChange={(e) => onCameraSelect?.(e.target.files?.[0])} className="hidden" />
      <input ref={galleryRef} type="file" accept="image/*"
        onChange={(e) => onGallerySelect?.(e.target.files?.[0])} className="hidden" />
      <button type="button" disabled={disabled} onClick={() => cameraRef.current?.click()}
        className={`${baseBtn} border-blue-300 text-blue-600 hover:bg-blue-50`}>
        <Camera className={layout === 'compact' ? 'w-6 h-6' : 'w-8 h-8 mb-2'} />
        <span className={layout === 'compact' ? '' : 'text-sm font-medium text-blue-700'}>Take Photo</span>
      </button>
      <button type="button" disabled={disabled} onClick={() => galleryRef.current?.click()}
        className={`${baseBtn} border-green-300 text-green-600 hover:bg-green-50`}>
        <Upload className={layout === 'compact' ? 'w-6 h-6' : 'w-8 h-8 mb-2'} />
        <span className={layout === 'compact' ? '' : 'text-sm font-medium text-green-700'}>{layout === 'compact' ? 'From Gallery' : 'Upload Photo'}</span>
      </button>
    </div>
    </div>
  );
};

export default CameraGalleryButtons;
