import React, { useEffect, useRef, useState } from 'react';

/**
 * Popup in-app numeric keypad (1-9, 0, backspace).
 * Slides up from bottom when `open` is true. Tap backdrop or Close to dismiss.
 *
 * Props:
 *   open: boolean
 *   onClose(): void
 *   onDigit(d: string): void   // called with "0".."9"
 *   onBackspace(): void
 *   typingDelayMs?: number     // throttle between key presses (default 140ms)
 */
const NumericKeypad = ({
  open,
  onClose,
  onDigit,
  onBackspace,
  typingDelayMs = 140,
}) => {
  const lastTapRef = useRef(0);
  const [pressed, setPressed] = useState(null);

  const throttle = (fn, key) => {
    const now = Date.now();
    if (now - lastTapRef.current < typingDelayMs) return;
    lastTapRef.current = now;
    setPressed(key);
    setTimeout(() => setPressed((p) => (p === key ? null : p)), 100);
    fn();
  };

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  const handleTap = (e, action, key) => {
    e.preventDefault();
    e.stopPropagation();
    throttle(action, key);
  };

  const btnBase =
    'select-none flex items-center justify-center text-2xl font-semibold ' +
    'rounded-2xl bg-white transition-all shadow-sm border border-gray-100 h-14';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose && onClose();
      }}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget) onClose && onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-md bg-gray-100 rounded-t-3xl shadow-2xl p-4 animate-slide-up"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => handleTap(e, () => onDigit(k), k)}
              onTouchStart={(e) => handleTap(e, () => onDigit(k), k)}
              className={`${btnBase} ${
                pressed === k ? 'bg-gray-300 scale-95' : 'active:bg-gray-200'
              }`}
            >
              {k}
            </button>
          ))}

          {/* Close (left) */}
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose && onClose();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose && onClose();
            }}
            className={`${btnBase} text-gray-500 text-base`}
            aria-label="Close keypad"
          >
            Close
          </button>

          {/* 0 */}
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => handleTap(e, () => onDigit('0'), '0')}
            onTouchStart={(e) => handleTap(e, () => onDigit('0'), '0')}
            className={`${btnBase} ${
              pressed === '0' ? 'bg-gray-300 scale-95' : 'active:bg-gray-200'
            }`}
          >
            0
          </button>

          {/* Backspace */}
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => handleTap(e, onBackspace, 'back')}
            onTouchStart={(e) => handleTap(e, onBackspace, 'back')}
            className={`${btnBase} ${
              pressed === 'back' ? 'bg-gray-300 scale-95' : 'active:bg-gray-200'
            }`}
            aria-label="Backspace"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12 12 14.25m-2.58 4.92-6.374-6.375a1.125 1.125 0 0 1 0-1.59L9.42 4.83c.21-.211.497-.33.795-.33H19.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25h-9.284c-.298 0-.585-.119-.795-.33Z"
              />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes nk-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up { animation: nk-slide-up 220ms ease-out; }
      `}</style>
    </div>
  );
};

export default NumericKeypad;
