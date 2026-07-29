/**
 * nativeInputMode.js
 *
 * Mobile keyboard rules:
 * - type="tel" + inputmode="numeric" → dial pad on Android WebView (reliable).
 * - type="text" + inputmode="numeric" → often full QWERTY on Android.
 * - autocomplete="one-time-code" on Android → Gboard QWERTY + SMS chip.
 *
 * Use type="tel" for ALL numeric fields except iOS OTP cells that need
 * one-time-code autofill (those stay type="text").
 */

import { Capacitor } from '@capacitor/core';

function isIOS() {
  return Capacitor.getPlatform() === 'ios';
}

function isAndroidUA() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

/**
 * @param {{ inputMode?: string, type?: string, autoComplete?: string, pattern?: string, isOtp?: boolean }} opts
 */
export function resolveNativeKeyboardAttrs({
  inputMode,
  type = 'text',
  autoComplete,
  pattern,
  isOtp = false,
} = {}) {
  let resolvedType = type === 'number' ? 'text' : type;
  let resolvedInputMode = inputMode;
  let resolvedAutoComplete = autoComplete;
  const resolvedPattern = pattern ?? (
    inputMode === 'numeric' || inputMode === 'decimal' || isOtp ? '[0-9]*' : undefined
  );

  const wantsNumeric = inputMode === 'numeric' || isOtp;
  const iosOtpAutofill = isIOS() && isOtp && autoComplete !== 'off';

  if (iosOtpAutofill) {
    // iOS only: SMS QuickType needs text + one-time-code.
    resolvedType = 'text';
    resolvedInputMode = 'numeric';
    resolvedAutoComplete = autoComplete ?? 'one-time-code';
  } else if (wantsNumeric) {
    // Android, iOS phone, web — tel is the cross-platform numeric dial pad.
    resolvedType = 'tel';
    resolvedInputMode = 'numeric';
    // Android Gboard: one-time-code forces QWERTY; use WebOTP instead.
    if (isOtp || autoComplete === 'one-time-code') {
      resolvedAutoComplete = 'off';
    }
  } else if (inputMode === 'decimal') {
    resolvedType = 'text';
    resolvedInputMode = 'decimal';
  }

  return {
    type: resolvedType,
    inputMode: resolvedInputMode,
    autoComplete: resolvedAutoComplete,
    pattern: resolvedPattern,
  };
}

export function applyNativeKeyboardAttrs(el, opts = {}) {
  if (!el || el.tagName !== 'INPUT') return;

  const resolved = resolveNativeKeyboardAttrs(opts);

  el.type = resolved.type;
  el.setAttribute('type', resolved.type);

  if (resolved.inputMode) {
    el.inputMode = resolved.inputMode;
    el.setAttribute('inputmode', resolved.inputMode);
  }
  if (resolved.pattern) {
    el.pattern = resolved.pattern;
    el.setAttribute('pattern', resolved.pattern);
  }
  if (resolved.autoComplete != null) {
    el.autocomplete = resolved.autoComplete;
    el.setAttribute('autocomplete', resolved.autoComplete);
  }
}

function optsFromElement(el) {
  const mode = el.getAttribute('inputmode') || el.inputMode || undefined;
  const ac = el.getAttribute('autocomplete') ?? el.autocomplete ?? undefined;
  const isOtp =
    el.dataset.otp === 'true'
    || ac === 'one-time-code'
    || (el.maxLength === 1 && (mode === 'numeric' || el.type === 'tel'));

  return {
    inputMode: mode,
    type: el.type,
    autoComplete: ac,
    pattern: el.getAttribute('pattern') || el.pattern || undefined,
    isOtp,
  };
}

export function syncNativeInputAttrs(el) {
  if (!el || el.tagName !== 'INPUT') return;
  applyNativeKeyboardAttrs(el, optsFromElement(el));
}

let installed = false;

export function installNativeInputModeSync() {
  if (installed) return;
  installed = true;

  const sync = (e) => {
    if (e.target?.tagName === 'INPUT') {
      syncNativeInputAttrs(e.target);
    }
  };

  document.addEventListener('touchstart', sync, true);
  document.addEventListener('focusin', sync, true);

  requestAnimationFrame(() => {
    document.querySelectorAll('input').forEach(syncNativeInputAttrs);
  });
}

export function mergeNativeInputRef(ref) {
  return (el) => {
    if (el) {
      applyNativeKeyboardAttrs(el, optsFromElement(el));
    }
    if (typeof ref === 'function') {
      ref(el);
    } else if (ref && typeof ref === 'object') {
      ref.current = el;
    }
  };
}

/** True when we should use tel dial-pad (for tests / logging). */
export function isAndroidKeyboardContext() {
  return Capacitor.getPlatform() === 'android' || isAndroidUA();
}
