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
  logger.info('[mdt-sms] sending SMS request', {
    route: 'mdt-sms',
    senderId,
    numberLen: number.length,
    apiHost: (() => { try { return new URL(apiUrl).host; } catch { return 'unknown'; } })(),
  });

  const res = await fetch(url, { method: 'GET' });

  const body = await res.text();
  if (!res.ok) {
    logger.warn('[mdt-sms] HTTP error', { status: res.status, route: 'mdt-sms' });
    throw new Error(`MDT SMS HTTP ${res.status}`);
  }

  // #region agent log
  let mdtStatus = 'unknown';
  let mdtCode = '';
  let mdtDesc = '';
  try {
    const j = JSON.parse(body);
    mdtStatus = String(j.status ?? '');
    mdtCode = String(j.code ?? '');
    mdtDesc = String(j.description ?? j.message ?? '').slice(0, 120);
  } catch { /* plain text */ }
  logger.info('[mdt-sms] provider raw response', {
    route: 'mdt-sms',
    mdtStatus,
    mdtCode,
    mdtDesc,
    senderId,
    numberLen: number.length,
  });
  fetch('http://127.0.0.1:7614/ingest/1b02d057-3db7-401f-8265-b89fca49dfb2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'450563'},body:JSON.stringify({sessionId:'450563',hypothesisId:'H1',location:'mdt-sms.client.js:response',message:'MDT provider response',data:{httpStatus:res.status,mdtStatus,mdtCode,mdtDesc,numberLen:number.length,senderId},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  const parsed = parseMdtSendResponse(body);
  logger.debug('[mdt-sms] SMS accepted by provider', { route: 'mdt-sms', senderId });
  return parsed;
}
