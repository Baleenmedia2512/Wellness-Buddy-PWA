/**
 * Focus an input and request the soft numeric keyboard on Android + iOS.
 *
 * - Android native: `.focus()` + synthetic `.click()` + Keyboard.show() so the
 *   IME opens reliably in WebView.
 * - iOS native: Capacitor allows `.focus()` to open the pad — no click / show.
 * - Web: `.focus()` only. Never synthetic click (it re-selects the field value).
 * - Never re-focus an already-focused field — mobile web `type=tel` often
 *   selects the whole value on focus(), so the next digit replaces the number.
 */
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

/**
 * @param {HTMLElement | null | undefined} el
 * @returns {void}
 */
export function focusInputForKeyboard(el) {
  if (!el || typeof el.focus !== 'function') return;

  // Mobile Chrome/Safari: focus() on an already-focused tel field re-selects
  // all digits; the next keypress deletes what the user typed.
  if (typeof document !== 'undefined' && document.activeElement === el) {
    return;
  }

  try {
    el.focus({ preventScroll: true });
  } catch {
    try {
      el.focus();
    } catch {
      return;
    }
  }

  // Synthetic click is Android WebView-only. On web it fires a non-trusted
  // click without mousedown, so installSelectAllOnTextFocus selects the whole
  // value mid-typing and the next digit replaces the number. iOS must not click.
  if (isNativeAndroid()) {
    try {
      if (typeof el.click === 'function') el.click();
    } catch {
      // Non-fatal
    }
    Keyboard.show().catch(() => {});
  }
}

/**
 * Schedule repeated focus attempts so splash / remount races still open the pad.
 * Web: one short attempt only — delayed re-focus mid-typing selects/deletes digits.
 *
 * @param {() => HTMLElement | null | undefined} getEl
 * @param {number[]} [delaysMs]
 * @returns {() => void} cancel
 */
export function scheduleFocusInputForKeyboard(getEl, delaysMs) {
  const delays = delaysMs
    ?? (isNativePlatform() ? [50, 300, 700] : [50]);
  const timers = delays.map((ms) =>
    setTimeout(() => {
      const el = getEl();
      if (!el) return;
      if (typeof document !== 'undefined' && document.activeElement === el) return;
      focusInputForKeyboard(el);
    }, ms),
  );
  return () => timers.forEach(clearTimeout);
}
