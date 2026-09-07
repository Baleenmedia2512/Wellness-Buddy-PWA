import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { debugLog } from './logger.js';
import { isCallablePhone, telHref, whatsAppHref, whatsAppPhoneDigits } from '../domain/phoneContact.js';

/**
 * Open the device dialer for a phone number.
 * @param {unknown} phone
 * @returns {Promise<boolean>}
 */
export async function openPhoneCall(phone) {
  const href = telHref(phone);
  if (!href) return false;

  if (Capacitor.isNativePlatform()) {
    try {
      await App.openUrl({ url: href });
      return true;
    } catch (err) {
      debugLog('openPhoneCall: App.openUrl failed, falling back', err?.message);
    }
  }

  window.location.href = href;
  return true;
}

/**
 * Open WhatsApp chat with a phone number.
 * Native Android uses WhatsAppShare.openChat when available; otherwise wa.me.
 * @param {unknown} phone
 * @returns {Promise<boolean>}
 */
export async function openWhatsAppChat(phone) {
  if (!isCallablePhone(phone)) return false;
  const digits = whatsAppPhoneDigits(phone);
  const webHref = whatsAppHref(phone);
  if (!digits || !webHref) return false;

  if (Capacitor.isNativePlatform()) {
    try {
      const { WhatsAppShare } = Capacitor.Plugins || {};
      if (WhatsAppShare && typeof WhatsAppShare.openChat === 'function') {
        await WhatsAppShare.openChat({ phoneNumber: digits });
        return true;
      }
    } catch (err) {
      debugLog('openWhatsAppChat: plugin failed, falling back', err?.message);
    }

    try {
      const { completed } = await App.openUrl({ url: `whatsapp://send?phone=${digits}` });
      if (completed) return true;
    } catch (err) {
      debugLog('openWhatsAppChat: whatsapp:// failed, falling back', err?.message);
    }

    try {
      await App.openUrl({ url: webHref });
      return true;
    } catch (err) {
      debugLog('openWhatsAppChat: wa.me openUrl failed', err?.message);
    }
  }

  window.open(webHref, '_blank', 'noopener,noreferrer');
  return true;
}
