import logger from '../../../shared/lib/logger.js';
import { formatMdtDialNumber } from '../domain/mdt-phone.rules.js';
import { parseMdtSendResponse } from '../domain/mdt-api-response.rules.js';

const DEFAULT_MDT_URL = 'http://app.mydreamstechnology.in/vb/apikey.php';

export function isMdtSmsConfigured() {
  return Boolean(process.env.MDT_SMS_API_KEY && process.env.MDT_SMS_SENDER_ID);
}

/**
 * Send a transactional SMS via My Dreams Technology HTTP API.
 * @param {{ e164: string, message: string }} params
 * @returns {Promise<object|string>} parsed provider response
 */
export async function sendMdtSms({ e164, message }) {
  const apiKey = process.env.MDT_SMS_API_KEY;
  const senderId = process.env.MDT_SMS_SENDER_ID;
  const apiUrl = process.env.MDT_SMS_API_URL || DEFAULT_MDT_URL;

  if (!apiKey || !senderId) {
    throw new Error('MDT SMS not configured: set MDT_SMS_API_KEY and MDT_SMS_SENDER_ID');
  }

  const number = formatMdtDialNumber(e164);
  if (!number) {
    throw new Error('Invalid phone number for MDT SMS');
  }

  const params = new URLSearchParams({
    apikey: apiKey,
    senderid: senderId,
    number,
    message: String(message || ''),
  });

  const url = `${apiUrl}?${params.toString()}`;
  const res = await fetch(url, { method: 'GET' });

  const body = await res.text();
  if (!res.ok) {
    logger.warn('[mdt-sms] HTTP error', { status: res.status, route: 'mdt-sms' });
    throw new Error(`MDT SMS HTTP ${res.status}`);
  }

  const parsed = parseMdtSendResponse(body);
  logger.debug('[mdt-sms] SMS accepted by provider', { route: 'mdt-sms', senderId });
  return parsed;
}
