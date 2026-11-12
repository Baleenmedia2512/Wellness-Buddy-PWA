/**
 * Admin and member clients for the existing mandatory-field APIs.
 * Identity is the same client-supplied user id the rest of the app sends.
 */
import { getApiBaseUrl } from '../../../config/api.config.js';
import { apiFetch } from '../../../shared/services/apiFetch.js';

function base(apiBaseUrl) {
  return (apiBaseUrl || getApiBaseUrl() || '').replace(/\/$/, '');
}

async function readBody(res) {
  return res.json().catch(() => ({}));
}

function fail(res, data, fallback) {
  const err = new Error(data?.message || fallback);
  err.status = res.status;
  err.code = data?.code || null;
  err.body = data;
  return err;
}

export async function fetchAdminMandatoryFields({ userId, email, apiBaseUrl } = {}) {
  const params = new URLSearchParams();
  if (userId) params.set('userId', String(userId));
  if (email) params.set('email', String(email));
  const res = await apiFetch(`${base(apiBaseUrl)}/api/admin/mandatory-fields?${params}`, { apiBaseUrl });
  const data = await readBody(res);
  if (!res.ok || data?.success === false) throw fail(res, data, 'Could not load mandatory fields.');
  return Array.isArray(data.fields) ? data.fields : [];
}

export async function saveAdminMandatoryField({ userId, email, fieldKey, rule, apiBaseUrl } = {}) {
  const params = new URLSearchParams();
  if (userId) params.set('userId', String(userId));
  if (email) params.set('email', String(email));
  const res = await apiFetch(
    `${base(apiBaseUrl)}/api/admin/mandatory-fields/${encodeURIComponent(fieldKey)}?${params}`,
    {
      apiBaseUrl,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email, ...(rule || {}) }),
    },
  );
  const data = await readBody(res);
  if (!res.ok || data?.success === false) throw fail(res, data, 'Could not save this field.');
  return data.field || null;
}

export async function fetchUserMandatoryFields({ userId, email, apiBaseUrl } = {}) {
  const params = new URLSearchParams();
  if (userId) params.set('userId', String(userId));
  if (email) params.set('email', String(email));
  const res = await apiFetch(`${base(apiBaseUrl)}/api/user/mandatory-fields?${params}`, { apiBaseUrl });
  const data = await readBody(res);
  if (!res.ok || data?.success === false) throw fail(res, data, 'Could not check required profile fields.');
  return {
    blocked: data.blocked === true,
    fields: Array.isArray(data.fields) ? data.fields : [],
  };
}

export async function skipUserMandatoryField({ userId, email, fieldKey, apiBaseUrl } = {}) {
  const params = new URLSearchParams();
  if (userId) params.set('userId', String(userId));
  if (email) params.set('email', String(email));
  const res = await apiFetch(
    `${base(apiBaseUrl)}/api/user/mandatory-fields/${encodeURIComponent(fieldKey)}/skip?${params}`,
    { apiBaseUrl, method: 'POST' },
  );
  const data = await readBody(res);
  if (!res.ok || data?.success === false) throw fail(res, data, 'This field could not be skipped.');
  return {
    blocked: data.blocked === true,
    fields: Array.isArray(data.fields) ? data.fields : [],
  };
}
