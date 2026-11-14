/**
 * A confirmed profile OTP value stays on screen until Profile returns that
 * same value. A reload that still has the previous row must not replace it
 * or reopen the code box.
 */

function browserSession() {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch { /* private mode */ }
  return null;
}

function storageKey(userId) {
  const id = String(userId ?? '').trim();
  return id ? `wv.profileOtpHold.${id}` : '';
}

function readHold(userId, storage) {
  const key = storageKey(userId);
  if (!key || !storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeHold(userId, hold, storage) {
  const key = storageKey(userId);
  if (!key || !storage) return;
  const has = Boolean(
    hold?.communityId || hold?.height || hold?.email || hold?.teamSeat || hold?.eventLevel,
  );
  try {
    if (!has) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(hold));
  } catch { /* private mode */ }
}

function sameText(left, right) {
  return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

function sameHeight(left, right) {
  const a = Number(left);
  const b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) < 0.05;
}

export function rememberProfileOtpConfirmation(userId, patch = {}, storage = browserSession()) {
  const next = { ...(readHold(userId, storage) || {}) };
  if (patch.communityId != null && String(patch.communityId).trim()) {
    next.communityId = String(patch.communityId).trim();
  }
  if (patch.teamSeat != null && String(patch.teamSeat).trim()) {
    next.teamSeat = String(patch.teamSeat).trim();
  }
  if (patch.height != null && String(patch.height).trim()) {
    next.height = String(patch.height).trim();
  }
  if (patch.email != null && String(patch.email).trim()) {
    next.email = String(patch.email).trim();
  }
  if (patch.eventLevel != null && String(patch.eventLevel).trim()) {
    next.eventLevel = String(patch.eventLevel).trim().toUpperCase();
  }
  writeHold(userId, next, storage);
}

/**
 * @param {object|null|undefined} data
 * @param {number|string|null|undefined} userId
 * @param {Storage|null} [storage]
 */
export function overlayProfileOtpConfirmation(data, userId, storage = browserSession()) {
  if (!data || typeof data !== 'object') return data;
  const held = readHold(userId, storage);
  if (!held) return data;

  const next = { ...data };
  const remaining = { ...held };

  if (held.communityId) {
    const serverId = String(data.communityId || '').trim();
    if (serverId && sameText(serverId, held.communityId)) {
      delete remaining.communityId;
      if (data.teamSeat) delete remaining.teamSeat;
      else if (held.teamSeat) next.teamSeat = held.teamSeat;
    } else {
      next.communityId = held.communityId;
      if (held.teamSeat) next.teamSeat = held.teamSeat;
      const pendingCode = String(data.communityIdRequest?.communityId || '').trim();
      if (pendingCode && sameText(pendingCode, held.communityId)) {
        next.communityIdRequest = null;
      }
    }
  }

  if (held.eventLevel) {
    const serverLevel = String(
      data.eventLevel || data.EventLevel || data.communityPosition?.code || '',
    ).trim();
    if (serverLevel && sameText(serverLevel, held.eventLevel)) {
      delete remaining.eventLevel;
    } else {
      next.eventLevel = held.eventLevel;
      const pendingCode = String(data.communityPositionRequest?.positionCode || '').trim();
      if (pendingCode && sameText(pendingCode, held.eventLevel)) {
        next.communityPositionRequest = null;
      }
    }
  }

  if (held.height) {
    const serverHeight = data.height != null && data.height !== '' ? data.height : '';
    if (serverHeight !== '' && sameHeight(serverHeight, held.height)) {
      delete remaining.height;
    } else {
      next.height = held.height;
    }
  }

  if (held.email) {
    const serverEmail = String(data.email || '').trim();
    if (serverEmail && sameText(serverEmail, held.email)) {
      delete remaining.email;
    } else {
      next.email = held.email;
    }
  }

  writeHold(userId, remaining, storage);
  return next;
}
