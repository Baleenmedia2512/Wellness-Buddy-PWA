// Inline picture-upload card embedded in CompleteProfilePage.
import React from 'react';
import { Camera, Upload } from 'lucide-react';
import PicturePreview from '../picture/PicturePreview';
import FaceStatusBadge from '../shared/FaceStatusBadge';
import CameraGalleryButtons from '../shared/CameraGalleryButtons';

const CompletePictureSection = ({
  show, previewUrl, faceStatus, onRecrop, onSelectFile, isSaving, error,
}) => {
  if (!show) return null;
  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Camera className="w-5 h-5 text-green-600" />
        <h3 className="text-base font-semibold text-gray-800">Profile Picture</h3>
        <span className="text-xs text-red-500 ml-1">*Required</span>
      </div>
      <PicturePreview previewUrl={previewUrl} faceStatus={faceStatus}
        onRecrop={previewUrl ? onRecrop : undefined} isSaving={isSaving} />
      <FaceStatusBadge status={faceStatus} />
      {error && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
      <CameraGalleryButtons disabled={isSaving} layout="compact"
        onCameraSelect={onSelectFile} onGallerySelect={onSelectFile} />
      <div className="flex items-start gap-2 text-xs text-gray-500">
        <Upload className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <p>Use a clear, front-facing photo. We verify a face is visible before saving.</p>
      </div>
    </div>
  );
};

export default CompletePictureSection;
