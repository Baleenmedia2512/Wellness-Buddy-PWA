/**
 * Cloudflare R2 (S3-compatible) env contract.
 * Dual-write / avatar redirect no-ops when this is not fully configured.
 */

export function readR2Config(env = process.env) {
  const accountId = String(env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = String(env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = String(env.R2_BUCKET || '').trim();
  const publicBaseUrl = String(env.R2_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: publicBaseUrl || null,
    region: 'auto',
    endpointHost: accountId ? `${accountId}.r2.cloudflarestorage.com` : '',
  };
}

export function isR2Configured(env = process.env) {
  const c = readR2Config(env);
  return Boolean(c.accountId && c.accessKeyId && c.secretAccessKey && c.bucket);
}
