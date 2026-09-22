import React, { useEffect, useRef } from 'react';
import { EyeOff } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

const LONG_PRESS_MS = 520;

/**
 * Long-press (touch) / right-click (desktop) menu to hide an inactive
 * (Not Posted) Activity Report member.
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
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    return () => {
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
 * Attach long-press / context-menu handlers for Hide User.
 * @param {{
 *   enabled: boolean,
 *   onOpen: (anchor: { x: number, y: number }) => void,
 * }} args
 */
export function useActivityReportHideLongPress({ enabled, onOpen }) {
  const timerRef = useRef(null);
  const movedRef = useRef(false);

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
      event.preventDefault();
      onOpen({ x: event.clientX, y: event.clientY });
    },
    onTouchStart: (event) => {
      movedRef.current = false;
      clearTimer();
      const touch = event.touches?.[0];
      if (!touch) return;
      const x = touch.clientX;
      const y = touch.clientY;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (movedRef.current) return;
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
    onTouchMove: () => {
      movedRef.current = true;
      clearTimer();
    },
    onTouchEnd: clearTimer,
    onTouchCancel: clearTimer,
  };
}
