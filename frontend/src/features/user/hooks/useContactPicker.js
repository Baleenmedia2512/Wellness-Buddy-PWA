/**
 * frontend/src/features/user/hooks/useContactPicker.js
 *
 * Contact Picker API hook — allows users to pre-fill the phone number
 * field from their device address book with a single tap.
 *
 * Platform support:
 *   Android Chrome 80+ / Capacitor WebView: fully supported.
 *   iOS Safari: NOT supported (Contact Picker API absent).
 *   Firefox / Desktop: NOT supported.
 *
 * When the API is unavailable, `supported` is false and callers should
 * not render the "Use saved number" button at all (no fallback needed).
 *
 * Usage:
 *   const { supported, pick, picking } = useContactPicker();
 *   if (supported) <button onClick={pick}>Use saved number</button>
 *
 * Security: the OS presents its own native picker UI and only returns
 * the fields the user explicitly selects — this code never has access
 * to the full address book.
 */

import { useCallback, useState } from 'react';

/**
 * @returns {{
 *   supported: boolean,
 *   picking: boolean,
 *   pick: (onSelected: (phone: string) => void) => Promise<void>,
 * }}
 */
export function useContactPicker() {
  // The Contact Picker API is available when `navigator.contacts` and
  // `navigator.contacts.select` are both present.
  const supported =
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    typeof navigator.contacts.select === 'function';

  const [picking, setPicking] = useState(false);

  /**
   * Open the OS contact picker, extract the first phone number, and call
   * `onSelected` with the raw string. Silently no-ops on unsupported browsers.
   *
   * @param {(phone: string) => void} onSelected
   */
  const pick = useCallback(async (onSelected) => {
    if (!supported || picking) return;
    setPicking(true);
    try {
      // Request only the `tel` property — minimal permission surface.
      const contacts = await navigator.contacts.select(['tel'], { multiple: false });
      if (!contacts || contacts.length === 0) return;
      const rawPhones = contacts[0]?.tel;
      if (!Array.isArray(rawPhones) || rawPhones.length === 0) return;
      // Prefer the first number, strip any non-digit/+ characters for display.
      const phone = String(rawPhones[0] || '').trim();
      if (phone) onSelected(phone);
    } catch (err) {
      // User dismissed the picker (AbortError) or API threw — both are benign.
      // Do NOT surface an error to the user; just log at debug level.
      if (err?.name !== 'AbortError') {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.debug('[useContactPicker] unexpected error:', err?.name, err?.message);
        }
      }
    } finally {
      setPicking(false);
    }
  }, [supported, picking]);

  return { supported, picking, pick };
}
