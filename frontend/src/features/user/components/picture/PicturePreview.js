// Profile picture preview circle with face-detection spinner overlay.
import React from 'react';
import { Camera, Crop, Loader } from 'lucide-react';

const PicturePreview = ({ previewUrl, faceStatus, onRecrop, isSaving }) => {
  if (!previewUrl) {
    return (
      <div className="flex justify-center">
        <div className="w-40 h-40 rounded-full border-4 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500">No image selected</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="relative w-40 h-40 rounded-full border-4 border-green-500 overflow-hidden">
        <img src={previewUrl} alt="Profile Preview" className="w-full h-full object-cover" />
        {faceStatus === 'detecting' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>
      {onRecrop && (
        <button onClick={onRecrop} disabled={isSaving}
          className="inline-flex items-center space-x-1 text-xs text-green-600 hover:text-green-800 font-medium disabled:opacity-50">
          <Crop className="w-3.5 h-3.5" />
          <span>Re-crop</span>
        </button>
      )}
    </div>
  );
};

export default PicturePreview;
