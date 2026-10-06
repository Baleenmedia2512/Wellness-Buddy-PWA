/**
 * Focus an input and request the soft numeric keyboard on Android + iOS.
 *
 * - Android: programmatic `.focus()` often leaves the caret without the IME;
 *   call Keyboard.show() after focus.
 * - iOS: Capacitor sets keyboardShouldRequireUserInteraction=false on the
 *   WKWebView, so `.focus()` can open the pad. Do not call el.click() on iOS
 *   (it can dismiss/retrigger oddly) and skip Keyboard.show() (Android-only).
 */
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

function isNativeIos() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

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

  // Android WebViews sometimes need a synthetic click; iOS does not.
  if (!isNativeIos()) {
    try {
      if (typeof el.click === 'function') el.click();
    } catch {
      // Non-fatal
    }
  }

  // Keyboard.show() is supported on Android only.
  if (isNativeAndroid()) {
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
