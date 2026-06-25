import logger from '../../../shared/lib/logger.js';
import { formatMdtDialNumber, getMdtSmsConfigGaps, mdtApiKeyHint } from '../domain/mdt-phone.rules.js';
import { parseMdtSendResponse } from '../domain/mdt-api-response.rules.js';

const DEFAULT_MDT_URL = 'http://app.mydreamstechnology.in/vb/apikey.php';

export function isMdtSmsConfigured() {
  return getMdtSmsConfigGaps().length === 0;
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
    format: 'json',
  });

  const templateId = process.env.MDT_SMS_TEMPLATE_ID?.trim();
  if (templateId) {
    params.set('templateid', templateId);
  }

  const url = `${apiUrl}?${params.toString()}`;
  logger.info('[mdt-sms] sending SMS request', {
    route: 'mdt-sms',
    senderId,
    apiKeyHint: mdtApiKeyHint(apiKey),
    hasTemplateId: Boolean(templateId),
    templateIdHint: templateId ? `***${templateId.slice(-4)}` : 'not-set',
    numberHint: number.length >= 4 ? `***${number.slice(-4)}` : '****',
    numberLen: number.length,
    messageLen: String(message || '').length,
    apiHost: (() => { try { return new URL(apiUrl).host; } catch { return 'unknown'; } })(),
  });

  const res = await fetch(url, { method: 'GET' });

  const body = await res.text();
  if (!res.ok) {
    logger.warn('[mdt-sms] HTTP error', { status: res.status, route: 'mdt-sms' });
    throw new Error(`MDT SMS HTTP ${res.status}`);
  }

  const parsed = parseMdtSendResponse(body);
  logger.info('[mdt-sms] SMS accepted by provider', {
    route: 'mdt-sms',
    senderId,
    apiKeyHint: mdtApiKeyHint(apiKey),
  });
  return parsed;
}
