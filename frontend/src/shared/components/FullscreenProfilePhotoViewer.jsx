import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, UserRound } from 'lucide-react';

export default function FullscreenProfilePhotoViewer({
  isOpen,
  src,
  alt = 'Profile photo',
  title = 'Profile photo',
  onClose,
  onViewProfile,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[370] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <header
        className="flex flex-shrink-0 items-center gap-2 px-2"
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          paddingBottom: '12px',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-white hover:bg-white/15"
          aria-label="Back"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h2 className="min-w-0 flex-1 truncate pr-2 text-lg font-medium text-white">{title}</h2>
        {onViewProfile && (
          <button
            type="button"
            onClick={onViewProfile}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/25"
            aria-label="View profile"
          >
            <UserRound className="h-5 w-5" />
            <span>View profile</span>
          </button>
        )}
      </header>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <img
          src={src}
          alt={alt}
          className="w-full max-h-full object-contain"
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    </div>,
    document.body,
  );
}
