/**
 * MilesWeb disk for new image files.
 * Off unless FTP host, user, and password are all set, so R2 (or base64)
 * behaviour is unchanged when these variables are absent.
 */

export function readMileswebConfig(env = process.env) {
  const host = String(env.MILESWEB_FTP_HOST || '').trim();
  const user = String(env.MILESWEB_FTP_USER || '').trim();
  const password = String(env.MILESWEB_FTP_PASSWORD || '');
  const uploadRoot = String(env.MILESWEB_FTP_UPLOAD_ROOT || 'wellnessvalley/uploads')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  // "." means the FTP account home (cPanel chroot already points at uploads).
  const port = Number(env.MILESWEB_FTP_PORT || 21);
  const secure = String(env.MILESWEB_FTP_SECURE || 'true').toLowerCase() !== 'false';
  const publicBase = String(env.MILESWEB_PUBLIC_UPLOAD_BASE || '').trim().replace(/\/+$/, '');
  return {
    host,
    user,
    password,
    uploadRoot,
    port: Number.isFinite(port) && port > 0 ? port : 21,
    secure,
    publicBase: publicBase || null,
  };
}

export function isMileswebStorageEnabled(env = process.env) {
  const config = readMileswebConfig(env);
  return Boolean(config.host && config.user && config.password && config.uploadRoot);
}
