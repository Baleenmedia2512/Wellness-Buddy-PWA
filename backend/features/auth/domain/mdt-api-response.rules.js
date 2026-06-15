/**
 * Parse My Dreams Technology SMS API responses (pure — no I/O).
 * MDT often returns HTTP 200 with JSON: { status: "false", description: "..." }.
 */

export function parseMdtSendResponse(rawBody) {
  const trimmed = String(rawBody || '').trim();
  if (!trimmed) {
    throw new Error('MDT SMS empty response');
  }

  try {
    const parsed = JSON.parse(trimmed);
    const status = String(parsed.status ?? parsed.Status ?? '').toLowerCase();
    if (status === 'false' || status === '0' || status === 'failed' || status === 'error') {
      const detail = parsed.description || parsed.message || parsed.error || trimmed;
      throw new Error(`MDT SMS rejected: ${detail}`);
    }
    if (status === 'true' || status === 'success' || status === '1') {
      return parsed;
    }
    // Unknown JSON shape — treat non-empty body without explicit failure as OK.
    return parsed;
  } catch (err) {
    if (err.message.startsWith('MDT SMS')) throw err;
    // Plain-text success responses from legacy gateways.
    const lower = trimmed.toLowerCase();
    if (lower.includes('invalid') || lower.includes('error') || lower.includes('fail')) {
      throw new Error(`MDT SMS rejected: ${trimmed.slice(0, 200)}`);
    }
    return trimmed;
  }
}
