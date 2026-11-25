/**
 * App invite sharing service.
 * Supports:
 *   - Native Android / iOS: Opens WhatsApp directly via `whatsapp://send?text=...` (Capacitor App plugin)
 *     with fallback to Share.share.
 *   - Web / Desktop / PWA: Opens WhatsApp directly via `https://api.whatsapp.com/send?text=...`.
 *   - Clipboard fallback.
 *
 * Direct WhatsApp sharing with invitation template text and share link.
 */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { buildAppInviteShareText, buildWhatsAppInviteUrl } from '../domain/appInvite.rules';

/**
 * Execute the app invite share flow directly to WhatsApp.
 * @param {{ inviterName?: string }} [opts]
 * @returns {Promise<{ success: boolean, method: string }>}
 */
export async function shareAppInvite({ inviterName = '' } = {}) {
  const text = buildAppInviteShareText({ inviterName });
  const encoded = encodeURIComponent(text);

  // 1. Native Platform (Capacitor on Android / iOS) — open WhatsApp app directly
  if (Capacitor.isNativePlatform()) {
    try {
      const { completed } = await App.openUrl({ url: `whatsapp://send?text=${encoded}` });
      if (completed !== false) {
        return { success: true, method: 'whatsapp-native' };
      }
    } catch (err) {
      console.warn('[appInviteShare] App.openUrl failed, trying Share fallback:', err);
    }

    try {
      await Share.share({
        title: 'Join me on Wellness Valley',
        text,
        dialogTitle: 'Share on WhatsApp',
      });
      return { success: true, method: 'native' };
    } catch (err) {
      if ((err?.message || '').toLowerCase().includes('cancel')) {
        return { success: true, method: 'cancelled' };
      }
      console.warn('[appInviteShare] Native share failed, falling back:', err);
    }
  }

  // 2. Web Browser / PWA — Open WhatsApp directly
  if (typeof window !== 'undefined') {
    const waUrl = buildWhatsAppInviteUrl({ inviterName });
    try {
      const win = window.open(waUrl, '_blank', 'noopener,noreferrer');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        window.location.href = waUrl;
      }
      return { success: true, method: 'whatsapp-web' };
    } catch (err) {
      console.warn('[appInviteShare] window.open failed, trying window.location:', err);
      try {
        window.location.href = waUrl;
        return { success: true, method: 'whatsapp-web' };
      } catch {
        // continue to clipboard
      }
    }
  }

  // 3. Clipboard Fallback
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return { success: true, method: 'clipboard' };
  }

  return { success: false, method: 'none' };
}
