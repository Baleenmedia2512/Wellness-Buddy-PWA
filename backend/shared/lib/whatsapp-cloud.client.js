/**
 * WhatsApp Cloud API text send. Used only when the business sender is configured.
 * No message is sent when the token or phone id is missing.
 */
import logger from './logger.js';
import { normalizeWhatsAppPhone } from './whatsapp-share.rules.js';

export function isWhatsAppCloudConfigured() {
  return Boolean(
    String(process.env.WHATSAPP_CLOUD_TOKEN || '').trim()
    && String(process.env.WHATSAPP_CLOUD_PHONE_ID || '').trim(),
  );
}

/**
 * @param {{ to: string, text: string }} input
 * @returns {Promise<boolean>}
 */
export async function sendWhatsAppCloudText({ to, text }) {
  if (!isWhatsAppCloudConfigured()) {
    const error = new Error('WHATSAPP_NOT_CONFIGURED');
    error.code = 'WHATSAPP_NOT_CONFIGURED';
    throw error;
  }
  const digits = normalizeWhatsAppPhone(to);
  if (!digits) {
    const error = new Error('WHATSAPP_INVALID_PHONE');
    error.code = 'WHATSAPP_INVALID_PHONE';
    throw error;
  }

  const version = String(process.env.WHATSAPP_CLOUD_API_VERSION || 'v21.0').trim() || 'v21.0';
  const phoneId = String(process.env.WHATSAPP_CLOUD_PHONE_ID).trim();
  const token = String(process.env.WHATSAPP_CLOUD_TOKEN).trim();
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: digits,
      type: 'text',
      text: { preview_url: false, body: String(text || '').slice(0, 4096) },
    }),
  });

  if (!res.ok) {
    logger.warn('[whatsapp] cancellation message was not accepted', {
      status: res.status,
    });
    const error = new Error(`WHATSAPP_HTTP_${res.status}`);
    error.code = 'WHATSAPP_HTTP';
    throw error;
  }
  return true;
}
