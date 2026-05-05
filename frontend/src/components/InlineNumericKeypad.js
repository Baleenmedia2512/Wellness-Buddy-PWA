import React, { useRef, useState } from 'react';

/**
 * Inline always-visible numeric keypad (Google Pay style).
 * Renders in normal page flow (NOT a popup), so it never overlaps the OTP boxes.
 *
 * Props:
 *   onDigit(d: string): void   // called with "0".."9"
 *   onBackspace(): void
 *   typingDelayMs?: number     // throttle between key presses (default 120ms)
 *   className?: string         // optional wrapper className
 */
const InlineNumericKeypad = ({
  onDigit,
  onBackspace,
  typingDelayMs = 120,
  className = '',
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

  const handleTap = (e, action, key) => {
    e.preventDefault();
    e.stopPropagation();
    throttle(action, key);
  };

  const btnBase =
    'select-none flex items-center justify-center text-2xl font-semibold ' +
    'rounded-2xl bg-white transition-all shadow-sm border border-gray-100 h-14';

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className={`w-full ${className}`}>
      <div className="grid grid-cols-3 gap-3">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => handleTap(e, () => onDigit(k), k)}
            onTouchStart={(e) => handleTap(e, () => onDigit(k), k)}
            className={`${btnBase} ${
              pressed === k ? 'bg-gray-200 scale-95' : 'active:bg-gray-100'
            }`}
          >
            {k}
          </button>
        ))}

        {/* Empty placeholder (left) */}
        <div aria-hidden="true" />

        {/* 0 */}
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => handleTap(e, () => onDigit('0'), '0')}
          onTouchStart={(e) => handleTap(e, () => onDigit('0'), '0')}
          className={`${btnBase} ${
            pressed === '0' ? 'bg-gray-200 scale-95' : 'active:bg-gray-100'
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
            pressed === 'back' ? 'bg-gray-200 scale-95' : 'active:bg-gray-100'
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
  );
};

export default InlineNumericKeypad;
