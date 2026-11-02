/**
 * nativeInputMode.js
 *
 * Mobile keyboard rules:
 * - type="tel" + inputmode="numeric" → dial pad on Android WebView (reliable).
 * - type="text" + inputmode="numeric" → often full QWERTY on Android.
 * - OTP with autocomplete="one-time-code" → SMS suggestion chip (iOS QuickType +
 *   Android Gboard/Autofill). Prefer the chip over dial-pad for OTP fields.
 *
 * Use type="tel" for non-OTP numeric fields. OTP cells that request
 * one-time-code stay type="text" so the OS can surface the SMS suggestion.
 */

import { Capacitor } from '@capacitor/core';

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
  const wantsOtpAutofill = isOtp && autoComplete !== 'off';

  if (wantsOtpAutofill) {
    // iOS + Android: SMS suggestion needs text + one-time-code on the focused field.
    resolvedType = 'text';
    resolvedInputMode = 'numeric';
    resolvedAutoComplete = autoComplete === 'one-time-code' || autoComplete == null
      ? 'one-time-code'
      : autoComplete;
  } else if (wantsNumeric) {
    // Phone / other numeric — tel dial pad; do not claim OTP autofill.
    resolvedType = 'tel';
    resolvedInputMode = 'numeric';
    if (autoComplete === 'one-time-code') {
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
