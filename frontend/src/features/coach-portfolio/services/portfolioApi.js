import { apiFetch } from '../../../shared/services/apiFetch.js';

/**
 * @param {string|number} userId
 * @returns {Promise<{ paid: boolean, status: string, userName?: string|null, source?: string|null, markedAt?: string|null }|null>}
 */
export async function fetchPortfolioStatus(userId) {
  try {
    const params = new URLSearchParams({ userId: String(userId) });
    const response = await apiFetch(`/api/coach-portfolio/status?${params.toString()}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.data) return null;
    return {
      paid: body.data.paid === true,
      status: String(body.data.status || 'not_paid'),
      userName: body.data.userName ?? null,
      source: body.data.source ?? null,
      markedAt: body.data.markedAt ?? null,
      userId: body.data.userId,
    };
  } catch {
    return null;
  }
}

/**
 * @param {{ requesterUserId: string|number, targetUserId: string|number, paid: boolean }} input
 */
export async function adminMarkPortfolioAccess({ requesterUserId, targetUserId, paid }) {
  const response = await apiFetch('/api/coach-portfolio/admin-mark', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requesterUserId, targetUserId, paid }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.ok) {
    const message = body?.error?.message || body?.message || 'Could not update portfolio access';
    throw new Error(message);
  }
  return body.data;
}

/**
 * Upload intro video to MilesWeb FTP. Returns { key, url, contentType, sizeBytes }.
 * @param {{ userId: string|number, file: File }} input
 */
export async function uploadPortfolioIntroVideo({ userId, file }) {
  const body = new FormData();
  body.append('userId', String(userId));
  body.append('video', file);
  const response = await apiFetch('/api/coach-portfolio/intro-video', {
    method: 'POST',
    body,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.ok) {
    const message = json?.error?.message || json?.message || 'Video upload failed';
    throw new Error(message);
  }
  return json.data;
}

/**
 * Upload portfolio image to MilesWeb FTP (wellnessvalley). Returns { key, url, slot, ... }.
 * @param {{ userId: string|number, slot: string, file: File }} input
 */
export async function uploadPortfolioMedia({ userId, slot, file }) {
  const body = new FormData();
  body.append('userId', String(userId));
  body.append('slot', String(slot || 'activity'));
  body.append('image', file);
  const response = await apiFetch('/api/coach-portfolio/media', {
    method: 'POST',
    body,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.ok) {
    const message = json?.error?.message || json?.message || 'Image upload failed';
    throw new Error(message);
  }
  return json.data;
}

/** Owned centers + website status for My Websites hub. */
export async function fetchMyWebsites(userId) {
  const params = new URLSearchParams({
    userId: String(userId),
    action: 'list',
  });
  const response = await apiFetch(`/api/coach-portfolio/submission?${params.toString()}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.ok) {
    const message = body?.error?.message || body?.message || 'Could not load websites';
    throw new Error(message);
  }
  return body.data || { websites: [], centerCount: 0 };
}

export async function fetchMyPortfolioSubmission(
  userId,
  centerId,
  { createNew = false, submissionId = null } = {},
) {
  const params = new URLSearchParams({ userId: String(userId) });
  if (centerId != null) params.set('centerId', String(centerId));
  if (submissionId != null) params.set('submissionId', String(submissionId));
  if (createNew === true) params.set('createNew', '1');
  const response = await apiFetch(`/api/coach-portfolio/submission?${params.toString()}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.ok) {
    const message = body?.error?.message || body?.message || 'Could not load form';
    throw new Error(message);
  }
  return body.data;
}

/**
 * @param {{
 *   userId: string|number,
 *   name: string,
 *   centerId?: string|number|null,
 *   submissionId?: string|number|null,
 *   city?: string|null,
 *   locality?: string|null,
 * }} input
 * @returns {Promise<{ available: boolean, name?: string, reason?: string }>}
 */
export async function checkPortfolioDisplayName({
  userId,
  name,
  centerId,
  submissionId = null,
  city = null,
  locality = null,
}) {
  const params = new URLSearchParams({
    userId: String(userId),
    name: String(name || ''),
  });
  if (centerId != null) params.set('centerId', String(centerId));
  if (submissionId != null) params.set('submissionId', String(submissionId));
  if (city) params.set('city', String(city));
  if (locality) params.set('locality', String(locality));
  const response = await apiFetch(`/api/coach-portfolio/display-name?${params.toString()}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.ok) {
    const message = body?.error?.message || body?.message || 'Could not check display name';
    throw new Error(message);
  }
  return body.data || { available: false };
}

export async function savePortfolioDraft({
  userId,
  centerId,
  form,
  createNew = false,
  submissionId = null,
}) {
  const response = await apiFetch('/api/coach-portfolio/submission', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      centerId: centerId ?? null,
      form,
      createNew: createNew === true,
      submissionId: submissionId ?? null,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.ok) {
    const message = body?.error?.message || body?.message || 'Could not save draft';
    throw new Error(message);
  }
  return body.data;
}

/** Step 1: validate + email OTP to the member's coach (site not live until verify). */
export async function requestPortfolioPublishOtp({
  userId,
  centerId,
  form,
  createNew = false,
  submissionId = null,
}) {
  const response = await apiFetch('/api/coach-portfolio/submission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'request-publish-otp',
      userId,
      centerId: centerId ?? null,
      form,
      createNew: createNew === true,
      submissionId: submissionId ?? null,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.ok) {
    const message = body?.error?.message || body?.message || 'Could not send publish OTP';
    throw new Error(message);
  }
  return body.data;
}

/** Step 2: verify coach OTP → public /coach/<slug>. */
export async function verifyPortfolioPublishOtp({ userId, centerId, otp, otpKey }) {
  const response = await apiFetch('/api/coach-portfolio/submission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'verify-publish-otp',
      userId,
      centerId: centerId ?? null,
      otp,
      otpKey: otpKey ?? null,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.ok) {
    const message = body?.error?.message || body?.message || 'Could not verify publish OTP';
    throw new Error(message);
  }
  return body.data;
}

/** @deprecated Prefer requestPortfolioPublishOtp — kept for older call sites. */
export async function submitPortfolioForm({ userId, form }) {
  return requestPortfolioPublishOtp({ userId, form });
}

export async function fetchAdminSubmissions({ requesterUserId, status }) {
  const params = new URLSearchParams({ requesterUserId: String(requesterUserId) });
  if (status) params.set('status', String(status));
  const response = await apiFetch(`/api/coach-portfolio/admin-submissions?${params.toString()}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.ok) {
    const message = body?.error?.message || body?.message || 'Could not load submissions';
    throw new Error(message);
  }
  return body.data;
}

export async function fetchAdminSubmissionDetail({ requesterUserId, targetUserId }) {
  const params = new URLSearchParams({
    requesterUserId: String(requesterUserId),
    targetUserId: String(targetUserId),
  });
  const response = await apiFetch(`/api/coach-portfolio/admin-submissions?${params.toString()}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.ok) {
    const message = body?.error?.message || body?.message || 'Could not load submission';
    throw new Error(message);
  }
  return body.data;
}

export async function updateAdminSubmissionStatus({
  requesterUserId,
  targetUserId,
  status,
  adminNote,
}) {
  const response = await apiFetch('/api/coach-portfolio/admin-submissions', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requesterUserId, targetUserId, status, adminNote }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.ok) {
    const message = body?.error?.message || body?.message || 'Could not update status';
    throw new Error(message);
  }
  return body.data;
}

/** Publish (or approve+publish) the public /coach/<slug> website. */
export async function publishAdminSubmission({ requesterUserId, targetUserId }) {
  const response = await apiFetch('/api/coach-portfolio/admin-submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requesterUserId, targetUserId }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.ok) {
    const message = body?.error?.message || body?.message || 'Could not publish website';
    throw new Error(message);
  }
  return body.data;
}
