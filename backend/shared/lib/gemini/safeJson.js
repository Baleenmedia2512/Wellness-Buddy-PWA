/**
 * backend/shared/lib/gemini/safeJson.js
 * ---------------------------------------------------------------------------
 * Safe JSON parsing and schema validation for Gemini responses.
 *
 * Gemini's `responseMimeType: 'application/json'` still occasionally returns
 * text-wrapped JSON or markdown fences. `safeParseJson` handles both.
 *
 * `validateShape` performs shallow key-presence validation so callers can
 * assert the minimum structure they need before using a value.
 * ---------------------------------------------------------------------------
 */

import logger from '../logger.js';

/**
 * Parse a raw Gemini response string into an object.
 *
 * Handles:
 *  - Plain JSON strings                → parsed directly
 *  - Markdown code-fenced JSON         → strips ``` wrapper then parses
 *  - Already-parsed objects            → returned as-is
 *
 * @param {string|object} raw
 * @param {{ label?: string }} [opts]
 * @returns {{ ok: true, data: object } | { ok: false, error: string, raw: string }}
 */
export function safeParseJson(raw, { label = 'gemini' } = {}) {
  if (raw === null || raw === undefined) {
    return { ok: false, error: 'Response was null or undefined', raw: String(raw) };
  }

  // Already an object — passthrough (Gemini SDK sometimes returns parsed object)
  if (typeof raw === 'object') {
    return { ok: true, data: raw };
  }

  if (typeof raw !== 'string') {
    return { ok: false, error: `Unexpected response type: ${typeof raw}`, raw: String(raw) };
  }

  let text = raw.trim();

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  try {
    const data = JSON.parse(text);
    return { ok: true, data };
  } catch (err) {
    logger.warn('safeParseJson: parse failed', { label, error: err.message, preview: text.slice(0, 120) });
    return { ok: false, error: `JSON parse error: ${err.message}`, raw: text };
  }
}

/**
 * Assert that `data` contains every key in `requiredKeys` with a non-null value.
 *
 * @param {object}   data
 * @param {string[]} requiredKeys
 * @param {{ label?: string }} [opts]
 * @returns {{ ok: true } | { ok: false, missing: string[] }}
 */
export function validateShape(data, requiredKeys, { label = 'gemini' } = {}) {
  if (!data || typeof data !== 'object') {
    return { ok: false, missing: requiredKeys };
  }
  const missing = requiredKeys.filter((k) => data[k] === undefined || data[k] === null);
  if (missing.length > 0) {
    logger.warn('validateShape: missing required keys', { label, missing });
    return { ok: false, missing };
  }
  return { ok: true };
}

/**
 * Parse and validate in one step. Returns `{ ok, data, error }`.
 * Preferred for endpoint handlers.
 *
 * @param {string|object} raw
 * @param {string[]}      requiredKeys
 * @param {{ label?: string }} [opts]
 */
export function parseAndValidate(raw, requiredKeys, opts = {}) {
  const parsed = safeParseJson(raw, opts);
  if (!parsed.ok) return parsed;

  const shape = validateShape(parsed.data, requiredKeys, opts);
  if (!shape.ok) {
    return {
      ok: false,
      error: `Response missing required fields: ${shape.missing.join(', ')}`,
      raw: typeof raw === 'string' ? raw.slice(0, 200) : JSON.stringify(raw).slice(0, 200),
    };
  }

  return { ok: true, data: parsed.data };
}
