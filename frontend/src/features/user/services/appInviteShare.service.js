/**
 * App invite sharing service.
 * Supports:
 *   - Native Android / iOS (via Capacitor Share, text-only)
 *   - Web Share API (text-only)
 *   - Clipboard fallback
 *
 * Shares ONLY the text invitation message with the Google Play Store link.
 * No image or logo is attached.
 */
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { buildAppInviteSharePayload } from '../domain/appInvite.rules';

/**
 * Execute the app invite share flow with text and Play Store link only.
 * @param {{ inviterName?: string }} [opts]
 * @returns {Promise<{ success: boolean, method: string }>}
 */
export async function shareAppInvite({ inviterName = '' } = {}) {
  const payload = buildAppInviteSharePayload({ inviterName });
  const textWithUrl = payload.text;

  // 1. Native Platform (Capacitor on Android / iOS) — text only, no image
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({
        title: payload.title,
        text: textWithUrl,
        dialogTitle: payload.dialogTitle,
      });
      return { success: true, method: 'native' };
    } catch (err) {
      if ((err?.message || '').toLowerCase().includes('cancel')) {
        return { success: true, method: 'cancelled' };
      }
      console.warn('[appInviteShare] Native share failed, falling back:', err);
    }
  }

  // 2. Web Share API (Mobile Browsers / Modern Desktops) — text only
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: payload.title,
        text: textWithUrl,
      });
      return { success: true, method: 'web' };
    } catch (err) {
      if (err?.name === 'AbortError') {
        return { success: true, method: 'cancelled' };
      }
      console.warn('[appInviteShare] Web Share failed, falling back:', err);
    }
  }

  // 3. Clipboard Fallback (Desktop Browsers / No Web Share)
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(textWithUrl);
    return { success: true, method: 'clipboard' };
  }

  return { success: false, method: 'none' };
}
