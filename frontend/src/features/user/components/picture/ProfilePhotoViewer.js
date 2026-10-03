// Full-screen profile photo viewer — tap the avatar to see the image.
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Crop, X } from 'lucide-react';

const ProfilePhotoViewer = ({
  isOpen,
  src,
  alt = 'Profile photo',
  onClose,
  onRecrop,
  onChange,
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col bg-black"
      style={{ zIndex: 370 }}
      role="dialog"
      aria-modal="true"
      aria-label="Profile photo"
      onClick={onClose}
    >
      <header
        className="flex-shrink-0 flex items-center justify-between px-4"
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          paddingBottom: '12px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white font-semibold text-base">Profile photo</span>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-white/15 text-white hover:bg-white/25"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className="relative flex-1 min-h-0 flex items-center justify-center px-3">
        <img
          src={src}
          alt={alt}
          className="max-h-full max-w-full object-contain rounded-xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <footer
        className="flex-shrink-0 px-4 pt-3"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3">
          {onRecrop && (
            <button
              type="button"
              onClick={onRecrop}
              className="flex-1 py-3 px-4 rounded-xl bg-white/10 text-white font-semibold inline-flex items-center justify-center gap-2"
            >
              <Crop className="w-4 h-4" />
              Re-crop
            </button>
          )}
          {onChange && (
            <button
              type="button"
              onClick={onChange}
              className="flex-1 py-3 px-4 rounded-xl bg-green-500 text-white font-semibold inline-flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Change
            </button>
          )}
        </div>
      </footer>
    </div>,
    document.body,
  );
};

export default ProfilePhotoViewer;
