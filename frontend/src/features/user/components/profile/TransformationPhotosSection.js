// First-run optional transformation photos. Not shown on Profile.
import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import CameraGalleryButtons from '../shared/CameraGalleryButtons';
import TransformationBeforeAfter from './TransformationBeforeAfter';
import { DEFAULT_TRANSFORMATION_COMPARE_TYPE } from '../../domain/transformationBeforeAfter';

const TransformationPhotosSection = ({
  onSelectFile,
  history = [],
  selectedType = DEFAULT_TRANSFORMATION_COMPARE_TYPE,
  onSelectType,
  disabled = false,
}) => {
  const [busy, setBusy] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      await onSelectFile(selectedType, file);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 pt-1">
      <div>
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-green-600" />
          <h3 className="text-sm font-semibold text-gray-800">Transformation Photos (Optional)</h3>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Upload Front, Left, and Right. Left is shown as Before and After on Transformation.
        </p>
      </div>
      <CameraGalleryButtons
        disabled={disabled || busy}
        onCameraSelect={handleFile}
        onGallerySelect={handleFile}
      />
      <p className="text-xs text-gray-400">You can upload any combination, or skip this section.</p>
      <TransformationBeforeAfter
        history={history}
        selectedType={selectedType}
        onSelectType={onSelectType}
      />
    </div>
  );
};

export default TransformationPhotosSection;
