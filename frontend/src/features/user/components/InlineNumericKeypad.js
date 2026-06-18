import React, { useRef, useState } from 'react';

/**
 * Inline always-visible numeric keypad (Google Pay style).
 * Renders in normal page flow (NOT a popup), so it never overlaps the OTP boxes.
 *
 * Props:
 *   onDigit(d: string): void   // called with "0".."9" or "."
 *   onBackspace(): void
 *   className?: string         // optional wrapper className
 *   showDecimal?: boolean      // show decimal point button (default: false)
 */
const InlineNumericKeypad = ({
  onDigit,
  onBackspace,
  className = '',
  showDecimal = false,
}) => {
  const [pressed, setPressed] = useState(null);
  // Guard against a single tap producing both pointerdown AND a synthetic
  // mousedown/click on some Android WebViews. We accept only ONE event per
  // physical tap.
  const tapHandledRef = useRef(false);
  const releaseTimerRef = useRef(null);

  const fire = (action, key) => {
    if (tapHandledRef.current) return;
    tapHandledRef.current = true;
    setPressed(key);
    action();
    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = setTimeout(() => {
      setPressed((p) => (p === key ? null : p));
      tapHandledRef.current = false;
    }, 120);
  };

  const handlePointerDown = (e, action, key) => {
    // Prevent the browser from firing a follow-up mousedown/click for this tap
    e.preventDefault();
    e.stopPropagation();
    fire(action, key);
  };

  const btnBase =
    'select-none flex items-center justify-center text-2xl font-semibold ' +
    'rounded-2xl bg-white transition-all shadow-sm border border-gray-100 h-14';

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className={`w-full ${className}`} style={{ touchAction: 'manipulation' }}>
      <div className="grid grid-cols-3 gap-3">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => handlePointerDown(e, () => onDigit(k), k)}
            style={{ touchAction: 'manipulation' }}
            className={`${btnBase} ${
              pressed === k ? 'bg-gray-200 scale-95' : 'active:bg-gray-100'
            }`}
          >
            {k}
          </button>
        ))}

        {/* Decimal point or empty placeholder (left) */}
        {showDecimal ? (
          <button
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => handlePointerDown(e, () => onDigit('.'), '.')}
            style={{ touchAction: 'manipulation' }}
            className={`${btnBase} ${
              pressed === '.' ? 'bg-gray-200 scale-95' : 'active:bg-gray-100'
            }`}
          >
            .
          </button>
        ) : (
          <div aria-hidden="true" />
        )}

        {/* 0 */}
        <button
          type="button"
          tabIndex={-1}
          onPointerDown={(e) => handlePointerDown(e, () => onDigit('0'), '0')}
          style={{ touchAction: 'manipulation' }}
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
          onPointerDown={(e) => handlePointerDown(e, onBackspace, 'back')}
          style={{ touchAction: 'manipulation' }}
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
