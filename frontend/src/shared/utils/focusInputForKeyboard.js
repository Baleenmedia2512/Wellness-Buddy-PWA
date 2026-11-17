/**
 * Focus an input and request the soft numeric keyboard on Android + iOS.
 *
 * - Android native: `.focus()` + synthetic `.click()` + Keyboard.show() so the
 *   IME opens reliably in WebView.
 * - iOS native: Capacitor allows `.focus()` to open the pad — no click / show.
 * - Web: `.focus()` only. Never synthetic click (it re-selects the field value).
 */
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * @param {HTMLElement | null | undefined} el
 * @returns {void}
 */
export function focusInputForKeyboard(el) {
  if (!el || typeof el.focus !== 'function') return;

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
 *
 * @param {() => HTMLElement | null | undefined} getEl
 * @param {number[]} [delaysMs]
 * @returns {() => void} cancel
 */
export function scheduleFocusInputForKeyboard(getEl, delaysMs = [50, 300, 700]) {
  const timers = delaysMs.map((ms) =>
    setTimeout(() => focusInputForKeyboard(getEl()), ms),
  );
  return () => timers.forEach(clearTimeout);
}
