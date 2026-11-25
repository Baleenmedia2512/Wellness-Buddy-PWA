import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { CENTRE_PHOTO_SLOTS, CENTRE_PHOTOS_MAX_PER_SLOT } from '../domain/centreProfile.rules.js';
import { compressCentrePhoto } from '../services/compressCentrePhoto.js';

function newPhotoId() {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function PhotoSlot({ slot, items, disabled, busy, onAdd, onRemove }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const room = CENTRE_PHOTOS_MAX_PER_SLOT - items.length;

  const takeFiles = (fileList) => {
    const files = Array.from(fileList || []).slice(0, room);
    if (files.length) onAdd(slot.key, files);
  };

  return (
    <div>
      <p className="block text-sm font-medium text-gray-700 mb-1">
        {slot.label} <span className="text-red-500">*</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((photo) => (
          <div key={photo.id} className="relative h-20 w-20">
            <img
              src={photo.dataUrl}
              alt=""
              className="h-20 w-20 rounded-lg object-cover border border-gray-200"
            />
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => onRemove(slot.key, photo.id)}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white"
              aria-label={`Remove ${slot.label} photo`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      {room > 0 && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => cameraRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" />
            Take photo
          </button>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => galleryRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 disabled:opacity-50"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Gallery
          </button>
        </div>
      )}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          takeFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          takeFiles(event.target.files);
          event.target.value = '';
        }}
      />
      {busy && <p className="mt-1 text-xs text-gray-400">Adding photo...</p>}
    </div>
  );
}

/**
 * Four required photo groups for a nutrition centre.
 */
export default function CentrePhotoSlots({ photos, onChange, disabled, onError }) {
  const [busyKey, setBusyKey] = useState(null);

  const onAdd = async (key, files) => {
    setBusyKey(key);
    try {
      const added = [];
      for (const file of files) {
        const dataUrl = await compressCentrePhoto(file);
        added.push({ id: newPhotoId(), dataUrl });
      }
      onChange({
        ...photos,
        [key]: [...(photos[key] || []), ...added].slice(0, CENTRE_PHOTOS_MAX_PER_SLOT),
      });
    } catch (err) {
      onError?.(err.message || 'Could not add that photo');
    } finally {
      setBusyKey(null);
    }
  };

  const onRemove = (key, id) => {
    onChange({
      ...photos,
      [key]: (photos[key] || []).filter((photo) => photo.id !== id),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-700">Centre photos</p>
        <p className="text-xs text-gray-500 mt-1">
          Add at least one photo in each group. Up to {CENTRE_PHOTOS_MAX_PER_SLOT} photos per group.
        </p>
      </div>
      {CENTRE_PHOTO_SLOTS.map((slot) => (
        <PhotoSlot
          key={slot.key}
          slot={slot}
          items={photos?.[slot.key] || []}
          disabled={disabled || (busyKey != null && busyKey !== slot.key)}
          busy={busyKey === slot.key}
          onAdd={onAdd}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
