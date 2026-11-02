import React, { useEffect, useRef } from 'react';
import { EyeOff } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

/** Hold still this long on the member name — short taps never open Hide. */
const LONG_PRESS_MS = 700;
const MOVE_CANCEL_PX = 12;

/**
 * Long-press menu to hide an inactive (Not Posted) Activity Report member.
 * Normal click / tap does not open this menu.
 */
export default function ActivityReportHideUserMenu({
  open,
  anchor,
  memberName,
  onHide,
  onClose,
  busy = false,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointer = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('keydown', onKey);
    // Delay so the opening gesture does not immediately close the menu.
    const closeTimer = setTimeout(() => {
      document.addEventListener('mousedown', onPointer);
      document.addEventListener('touchstart', onPointer);
    }, 0);

    return () => {
      clearTimeout(closeTimer);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const top = Math.min(
    typeof window !== 'undefined' ? window.innerHeight - 72 : 120,
    Math.max(8, (anchor?.y || 120) - 8),
  );
  const left = Math.min(
    typeof window !== 'undefined' ? window.innerWidth - 176 : 16,
    Math.max(8, (anchor?.x || 16)),
  );

  return (
    <div
      ref={menuRef}
      className="fixed z-[90] w-44 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden"
      style={{ top, left }}
      role="menu"
      aria-label="Member actions"
    >
      <TouchFeedbackButton
        onClick={onHide}
        disabled={busy}
        ariaLabel={`Hide user ${memberName || ''}`.trim()}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-red-50 disabled:opacity-50"
      >
        <EyeOff className="w-4 h-4 text-red-600" />
        <span className="font-medium">{busy ? 'Hiding…' : 'Hide User'}</span>
      </TouchFeedbackButton>
    </div>
  );
}

/**
 * Touch long-press on the member name only.
 * Blocks browser context menu. Left-click / short tap never opens Hide.
 */
export function useActivityReportHideLongPress({ enabled, onOpen }) {
  const timerRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => () => clearTimer(), []);

  if (!enabled) {
    return {};
  }

  return {
    onContextMenu: (event) => {
      // Block OS menu; do not open Hide on click / right-click.
      event.preventDefault();
      event.stopPropagation();
    },
    onClick: (event) => {
      // Short tap / click must never open Hide.
      event.stopPropagation();
    },
    onTouchStart: (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;
      startRef.current = { x: touch.clientX, y: touch.clientY };
      clearTimer();
      const x = touch.clientX;
      const y = touch.clientY;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (
          typeof navigator !== 'undefined'
          && 'vibrate' in navigator
          && navigator.userActivation?.isActive !== false
        ) {
          try { navigator.vibrate(12); } catch { /* ignore */ }
        }
        onOpen({ x, y });
      }, LONG_PRESS_MS);
    },
    onTouchMove: (event) => {
      const touch = event.touches?.[0];
      if (!touch || !timerRef.current) return;
      const dx = Math.abs(touch.clientX - startRef.current.x);
      const dy = Math.abs(touch.clientY - startRef.current.y);
      if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
        clearTimer();
      }
    },
    onTouchEnd: clearTimer,
    onTouchCancel: clearTimer,
  };
}
