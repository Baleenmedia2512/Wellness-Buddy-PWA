// WhatsApp-style full-screen profile photo — used by Top 10 Wellness Score.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';

const COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-teal-500',
];

export default function LeaderboardAvatarViewer({ isOpen, src, name, onClose }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src, isOpen]);

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

  if (!isOpen) return null;

  const shownName = String(name || '').trim() || 'Unknown';
  const showImage = Boolean(src) && !imageFailed;
  const initial = shownName.charAt(0).toUpperCase() || '?';
  const colorIndex = shownName.length % COLORS.length;

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col bg-black"
      style={{ zIndex: 370 }}
      role="dialog"
      aria-modal="true"
      aria-label={`${shownName}'s photo`}
      onClick={onClose}
    >
      <header
        className="flex-shrink-0 flex items-center gap-1 px-1"
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          paddingBottom: '12px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full text-white hover:bg-white/15"
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6" strokeWidth={2.5} />
        </button>
        <h2 className="min-w-0 truncate text-white text-lg font-medium pr-3">
          {shownName}
        </h2>
      </header>

      <div className="relative flex-1 min-h-0 flex items-center justify-center">
        {showImage ? (
          <img
            src={src}
            alt={shownName}
            className="w-full max-h-full object-contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div
            className={`w-56 h-56 rounded-full ${COLORS[colorIndex]} flex items-center justify-center text-white font-bold text-7xl`}
          >
            {initial}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
