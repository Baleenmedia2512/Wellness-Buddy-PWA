/**
 * Community Position is a profile role.
 * The dropdown is loaded from the catalog API — do not hard-code role names here.
 */
export const COMMUNITY_POSITION_OTP_FLAG = 'ff.community-position-otp';

export function communityPositionStorageKey(userId) {
  if (userId == null || String(userId).trim() === '') return '';
  return `wv.communityPosition.${userId}`;
}

function browserSession() {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch { /* private mode */ }
  return null;
}

/**
 * Remember the role the coach code just saved.
 * A later Profile read that still has the previous role must not replace it.
 */
export function rememberConfirmedCommunityPosition(userId, code, storage = browserSession()) {
  const key = communityPositionStorageKey(userId);
  const saved = String(code || '').trim();
  if (!key || !saved || !storage) return;
  try {
    storage.setItem(key, saved);
    storage.setItem(`${key}.hold`, saved);
  } catch { /* private mode */ }
}

export function readHeldCommunityPosition(userId, storage = browserSession()) {
  const key = communityPositionStorageKey(userId);
  if (!key || !storage) return '';
  try { return String(storage.getItem(`${key}.hold`) || '').trim(); } catch { return ''; }
}

/**
 * Role to show on Profile.
 * The code just confirmed stays until Profile returns that same code.
 * @param {object} data
 * @param {number|string|null|undefined} userId
 * @param {Storage|null} [storage]
 */
export function communityPositionFromProfile(data, userId, storage = browserSession()) {
  const fromServer = String(
    data?.eventLevel || data?.EventLevel || data?.communityPosition?.code || '',
  ).trim();
  const key = communityPositionStorageKey(userId);
  const held = readHeldCommunityPosition(userId, storage);
  if (held) {
    if (fromServer === held && key && storage) {
      try {
        storage.removeItem(`${key}.hold`);
        storage.setItem(key, held);
      } catch { /* private mode */ }
    }
    return held;
  }
  if (fromServer) {
    if (key && storage) {
      try { storage.setItem(key, fromServer); } catch { /* private mode */ }
    }
    return fromServer;
  }
  if (!key || !storage) return '';
  try { return String(storage.getItem(key) || '').trim(); } catch { return ''; }
}

/**
 * After a successful coach code, keep that role on screen until Profile
 * agrees. A reload that still has the old role or the just-used approval
 * must not put the OTP box back.
 * @param {{ settledCode?: string, confirmedCode?: string, pendingRequest?: { status?: string, positionCode?: string }|null }} input
 */
export function communityPositionDraftAfterSync({
  settledCode = '',
  confirmedCode = '',
  pendingRequest = null,
} = {}) {
  const settled = String(settledCode || '').trim();
  const confirmed = String(confirmedCode || '').trim();
  const pendingCode = pendingRequest?.status === 'pending'
    ? String(pendingRequest.positionCode || '').trim()
    : '';
  if (settled) {
    const parentCaughtUp = confirmed === settled && pendingCode !== settled;
    return { draft: settled, pending: null, clearSettled: parentCaughtUp };
  }
  return {
    draft: pendingCode || confirmed,
    pending: pendingRequest || null,
    clearSettled: false,
  };
}

export function positionUsageLine(position) {
  if (!position) return '';
  const note = String(position.usageNote || '').trim();
  if (note) return note;
  const key = String(position.featureKey || '').trim();
  return key ? `Features check the key ${key}.` : '';
}
