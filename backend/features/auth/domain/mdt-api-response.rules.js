/**
 * Parse My Dreams Technology SMS API responses (pure — no I/O).
 * Official success: status "Success", code "011" (per MDT developer docs).
 * Failures: status "false" or error codes 001–010 (and provider-specific e.g. 003 invalid sender).
 */

const MDT_SUCCESS_CODE = '011';

export function parseMdtSendResponse(rawBody) {
  const trimmed = String(rawBody || '').trim();
  if (!trimmed) {
    throw new Error('MDT SMS empty response');
  }

  try {
    const parsed = JSON.parse(trimmed);
    const status = String(parsed.status ?? parsed.Status ?? '').toLowerCase();
    const code = String(parsed.code ?? '').trim();
    const detail = parsed.description || parsed.message || parsed.error || trimmed;

    if (status === 'success' || code === MDT_SUCCESS_CODE) {
      return parsed;
    }

    if (
      status === 'false'
      || status === '0'
      || status === 'failed'
      || status === 'error'
      || (code && code !== MDT_SUCCESS_CODE)
    ) {
      const codeSuffix = code ? ` (code ${code})` : '';
      throw new Error(`MDT SMS rejected: ${detail}${codeSuffix}`);
    }

    return parsed;
  } catch (err) {
    if (err.message.startsWith('MDT SMS')) throw err;
    const lower = trimmed.toLowerCase();
    if (lower.includes('invalid') || lower.includes('error') || lower.includes('fail')) {
      throw new Error(`MDT SMS rejected: ${trimmed.slice(0, 200)}`);
    }
    return trimmed;
  }
}
