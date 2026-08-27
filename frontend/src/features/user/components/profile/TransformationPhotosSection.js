// Optional transformation photos — guided Front / Left / Right capture (on-device).
import React, { useState } from 'react';
import { Camera } from 'lucide-react';
import CameraGalleryButtons from '../shared/CameraGalleryButtons';
import TransformationBeforeAfter from './TransformationBeforeAfter';
import GuidedTransformationCapture from './GuidedTransformationCapture';
import { DEFAULT_TRANSFORMATION_COMPARE_TYPE } from '../../domain/transformationBeforeAfter';

const TransformationPhotosSection = ({
  onSelectFile,
  onApplyGuidedSlots,
  history = [],
  selectedType = DEFAULT_TRANSFORMATION_COMPARE_TYPE,
  onSelectType,
  previews = {},
  disabled = false,
}) => {
  const [busy, setBusy] = useState(false);
  const [guidedOpen, setGuidedOpen] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      await onSelectFile(selectedType, file);
    } finally {
      setBusy(false);
    }
  };

  const handleGuidedComplete = async (slots) => {
    setGuidedOpen(false);
    setBusy(true);
    try {
      await onApplyGuidedSlots?.(slots);
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
          Separate Front, Left, and Right screens with on-device pose guide (no Gemini).
        </p>
      </div>

      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => setGuidedOpen(true)}
        className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-sm disabled:opacity-50"
      >
        Start guided photos
      </button>

      <TransformationBeforeAfter
        history={history}
        selectedType={selectedType}
        onSelectType={onSelectType}
        slotActions={(
          <CameraGalleryButtons
            layout="inSlot"
            disabled={disabled || busy}
            onCameraClick={() => setGuidedOpen(true)}
            onGallerySelect={handleFile}
          />
        )}
      />
      <p className="text-xs text-gray-400 text-center">
        Guided capture checks pose on your device. Gallery upload skips the live check. You can skip any step.
      </p>

      <GuidedTransformationCapture
        open={guidedOpen}
        startStep={selectedType}
        existingPreviews={previews}
        onClose={() => setGuidedOpen(false)}
        onComplete={handleGuidedComplete}
      />
    </div>
  );
};

export default TransformationPhotosSection;
