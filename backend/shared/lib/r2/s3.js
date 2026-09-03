/**
 * Minimal S3 API for Cloudflare R2 (Sig V4). No AWS SDK.
 */
import crypto from 'crypto';
import { readR2Config, isR2Configured } from './config.js';

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function amzDateNow(now = new Date()) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function encodeRfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function encodeObjectKey(key) {
  return String(key).split('/').map(encodeRfc3986).join('/');
}

function objectUri(bucket, key) {
  return `/${encodeRfc3986(bucket)}/${encodeObjectKey(key)}`;
}

function requestUri(bucket, key) {
  if (!key) return `/${encodeRfc3986(bucket)}`;
  return objectUri(bucket, key);
}

function assertR2Config(config) {
  if (!isR2Configured({
    R2_ACCOUNT_ID: config.accountId,
    R2_ACCESS_KEY_ID: config.accessKeyId,
    R2_SECRET_ACCESS_KEY: config.secretAccessKey,
    R2_BUCKET: config.bucket,
  })) {
    throw new Error('R2 is not configured');
  }
}

function decodeXmlText(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function parseListObjectsXml(xml) {
  const text = String(xml || '');
  const keys = [];
  const keyRe = /<Key>([^<]+)<\/Key>/g;
  let match;
  while ((match = keyRe.exec(text))) {
    keys.push(decodeXmlText(match[1]));
  }
  const tokenMatch = text.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
  return {
    keys,
    isTruncated: /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(text),
    nextContinuationToken: tokenMatch ? decodeXmlText(tokenMatch[1]) : null,
  };
}

function signingKey(secret, dateStamp, region, service) {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function canonicalQuery(params) {
  return Object.keys(params)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(String(params[k]))}`)
    .join('&');
}

function lowercaseHeaderMap(headers) {
  const out = {};
  Object.entries(headers || {}).forEach(([k, v]) => {
    if (v == null) return;
    out[String(k).toLowerCase()] = String(v).trim();
  });
  return out;
}

/**
 * @param {object} opts
 */
export function buildSignedHeaders({
  method,
  key,
  body = '',
  headers = {},
  query = {},
  config = readR2Config(),
  now = new Date(),
}) {
  const { amzDate, dateStamp } = amzDateNow(now);
  const payloadHash = sha256Hex(body || '');
  const uri = requestUri(config.bucket, key);
  const headerMap = lowercaseHeaderMap({
    host: config.endpointHost,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...headers,
  });
  const signedHeaderNames = Object.keys(headerMap).sort();
  const canonicalHeaders = `${signedHeaderNames.map((n) => `${n}:${headerMap[n]}`).join('\n')}\n`;
  const signedHeaders = signedHeaderNames.join(';');
  const canonicalQueryString = canonicalQuery(query);
  const canonicalRequest = [
    method,
    uri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signature = crypto
    .createHmac('sha256', signingKey(config.secretAccessKey, dateStamp, config.region, 's3'))
    .update(stringToSign, 'utf8')
    .digest('hex');

  return {
    amzDate,
    payloadHash,
    uri,
    signedHeaders,
    signature,
    authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    queryString: canonicalQueryString,
    headerMap,
  };
}

export function publicObjectUrl(key, config = readR2Config()) {
  if (!config.publicBaseUrl || !key) return null;
  return `${config.publicBaseUrl}/${encodeObjectKey(key)}`;
}

/**
 * Presigned GET so a private bucket can still serve avatars via 302.
 */
export function signedGetObjectUrl(key, opts = {}) {
  const config = opts.config || readR2Config();
  const expiresSeconds = opts.expiresSeconds || 3600;
  const now = opts.now || new Date();
  const { amzDate, dateStamp } = amzDateNow(now);
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const uri = objectUri(config.bucket, key);
  const query = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${config.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': 'host',
  };
  const canonicalQueryString = canonicalQuery(query);
  const canonicalRequest = [
    'GET',
    uri,
    canonicalQueryString,
    `host:${config.endpointHost}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signature = crypto
    .createHmac('sha256', signingKey(config.secretAccessKey, dateStamp, config.region, 's3'))
    .update(stringToSign, 'utf8')
    .digest('hex');
  const qs = `${canonicalQueryString}&${encodeRfc3986('X-Amz-Signature')}=${encodeRfc3986(signature)}`;
  return `https://${config.endpointHost}${uri}?${qs}`;
}

export function avatarRedirectUrl(key, config = readR2Config()) {
  return publicObjectUrl(key, config) || signedGetObjectUrl(key, { config, expiresSeconds: 3600 });
}

export { buildAvatarObjectKey, R2_FOLDERS } from './objectKeys.js';

/**
 * @param {{ key: string, body: Buffer, contentType: string, cacheControl?: string, fetchImpl?: typeof fetch, config?: object }} input
 */
export async function putObject({
  key,
  body,
  contentType,
  cacheControl = 'public, max-age=31536000, immutable',
  fetchImpl = globalThis.fetch,
  config = readR2Config(),
}) {
  assertR2Config(config);

  const extraHeaders = {
    'content-type': contentType || 'image/jpeg',
  };
  if (cacheControl) extraHeaders['cache-control'] = cacheControl;

  const signed = buildSignedHeaders({
    method: 'PUT',
    key,
    body,
    headers: extraHeaders,
    config,
  });

  const url = `https://${config.endpointHost}${signed.uri}`;
  const res = await fetchImpl(url, {
    method: 'PUT',
    headers: {
      ...extraHeaders,
      host: config.endpointHost,
      'x-amz-content-sha256': signed.payloadHash,
      'x-amz-date': signed.amzDate,
      Authorization: signed.authorization,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`R2 PUT failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return { key, etag: res.headers?.get?.('etag') || null };
}

/**
 * DELETE an object. 404 is treated as already gone.
 * @param {{ key: string, fetchImpl?: typeof fetch, config?: object }} input
 */
export async function deleteObject({
  key,
  fetchImpl = globalThis.fetch,
  config = readR2Config(),
}) {
  assertR2Config(config);
  if (!key) throw new Error('R2 DELETE requires a key');

  const signed = buildSignedHeaders({
    method: 'DELETE',
    key,
    body: '',
    config,
  });

  const url = `https://${config.endpointHost}${signed.uri}`;
  const res = await fetchImpl(url, {
    method: 'DELETE',
    headers: {
      host: config.endpointHost,
      'x-amz-content-sha256': signed.payloadHash,
      'x-amz-date': signed.amzDate,
      Authorization: signed.authorization,
    },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`R2 DELETE failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return { key, deleted: res.status !== 404 };
}

/**
 * List object keys under a prefix (ListObjectsV2).
 * @param {{ prefix: string, fetchImpl?: typeof fetch, config?: object }} input
 * @returns {Promise<string[]>}
 */
export async function listObjectKeys({
  prefix,
  fetchImpl = globalThis.fetch,
  config = readR2Config(),
}) {
  assertR2Config(config);
  const keys = [];
  let continuationToken = null;

  do {
    const query = {
      'list-type': '2',
      'max-keys': '1000',
      prefix: String(prefix || ''),
    };
    if (continuationToken) query['continuation-token'] = continuationToken;

    const signed = buildSignedHeaders({
      method: 'GET',
      key: '',
      body: '',
      query,
      config,
    });

    const url = `https://${config.endpointHost}${signed.uri}?${signed.queryString}`;
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        host: config.endpointHost,
        'x-amz-content-sha256': signed.payloadHash,
        'x-amz-date': signed.amzDate,
        Authorization: signed.authorization,
      },
    });
    const xml = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(`R2 LIST failed (${res.status}): ${xml.slice(0, 300)}`);
    }
    const page = parseListObjectsXml(xml);
    keys.push(...page.keys);
    continuationToken = page.isTruncated ? page.nextContinuationToken : null;
  } while (continuationToken);

  return keys;
}

export { isR2Configured, readR2Config };
