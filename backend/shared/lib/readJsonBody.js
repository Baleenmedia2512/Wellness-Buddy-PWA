/**
 * Read and parse a JSON request body with bodyParser disabled.
 * Avoids Next.js throwing opaque `Error: Invalid JSON` (status 400)
 * before the route handler runs — which makes the client show a generic
 * "Failed to send OTP" after `res.json()` fails on a non-JSON error page.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<{ ok: true, body: object } | { ok: false, message: string }>}
 */
export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return { ok: true, body: {} };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        ok: false,
        message: 'Request body must be a JSON object.',
      };
    }
    return { ok: true, body: parsed };
  } catch {
    return {
      ok: false,
      message:
        'Invalid JSON body. Send Content-Type: application/json with a valid JSON object, e.g. {"recipient":"+91…","contactType":"phone"}.',
    };
  }
}
