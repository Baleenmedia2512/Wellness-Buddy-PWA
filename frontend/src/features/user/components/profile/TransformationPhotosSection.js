// Optional Front / Left / Right uploads. None required.
import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import CameraGalleryButtons from '../shared/CameraGalleryButtons';
import TransformationBeforeAfter from './TransformationBeforeAfter';

const SLOTS = [
  { key: 'front', label: 'Front Image' },
  { key: 'left', label: 'Left Image' },
  { key: 'right', label: 'Right Image' },
];

const SlotPicker = ({ label, preview, onSelectFile, disabled }) => {
  const [busy, setBusy] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      await onSelectFile(file);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      {preview ? (
        <img
          src={preview}
          alt={`${label} preview`}
          className="w-full aspect-[3/4] object-cover rounded-xl border border-green-200"
        />
      ) : (
        <div className="w-full aspect-[3/4] rounded-xl border-2 border-dashed border-gray-200 bg-gray-50" />
      )}
      <CameraGalleryButtons
        disabled={disabled || busy}
        layout="compact"
        onCameraSelect={handleFile}
        onGallerySelect={handleFile}
      />
    </div>
  );
};

const TransformationPhotosSection = ({
  previews,
  onSelectFile,
  history = [],
  disabled = false,
}) => (
  <div className="space-y-3 pt-1">
    <div>
      <div className="flex items-center gap-2">
        <Camera className="w-4 h-4 text-green-600" />
        <h3 className="text-sm font-semibold text-gray-800">Transformation Photos (Optional)</h3>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Upload your photos to track your transformation progress.
      </p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {SLOTS.map(({ key, label }) => (
        <SlotPicker
          key={key}
          label={label}
          preview={previews?.[key]}
          disabled={disabled}
          onSelectFile={(file) => onSelectFile(key, file)}
        />
      ))}
    </div>
    <p className="text-xs text-gray-400">You can upload any combination, or skip this section.</p>
    <TransformationBeforeAfter history={history} latestSlots={previews} />
  </div>
);

export default TransformationPhotosSection;
