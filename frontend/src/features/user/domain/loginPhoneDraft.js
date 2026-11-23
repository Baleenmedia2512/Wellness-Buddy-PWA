/**
 * Persist the in-progress login phone field across Login remounts.
 *
 * On web, App shows <Login> while authLoading, then mounts a fresh <Login>
 * when Firebase finishes — wiping React state mid-typing. sessionStorage +
 * an in-memory mirror keep digits / country / terms across that swap.
 */

export const LOGIN_PHONE_DRAFT_KEY = 'wv.loginPhoneDraft';

/** @type {object|null} */
let memoryDraft = null;

function browserSession() {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    /* private mode */
  }
  return null;
}

/**
 * @param {object|null|undefined} raw
 * @returns {object|null}
 */
export function normalizeLoginPhoneDraft(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const email = String(raw.email || '').trim();
  const countryDial = String(raw.countryDial || '').trim();
  if (!email && !countryDial && raw.termsAccepted !== true) return null;
  return {
    email,
    countryDial: countryDial || '+91',
    termsAccepted: raw.termsAccepted === true,
  };
}

/**
 * @param {Storage|null} [storage]
 * @returns {object|null}
 */
export function loadLoginPhoneDraft(storage = browserSession()) {
  if (memoryDraft) {
    const fromMemory = normalizeLoginPhoneDraft(memoryDraft);
    if (fromMemory) return fromMemory;
  }
  if (!storage) return null;
  try {
    const raw = storage.getItem(LOGIN_PHONE_DRAFT_KEY);
    if (!raw) return null;
    const draft = normalizeLoginPhoneDraft(JSON.parse(raw));
    if (!draft) {
      storage.removeItem(LOGIN_PHONE_DRAFT_KEY);
      return null;
    }
    memoryDraft = draft;
    return draft;
  } catch {
    try {
      storage.removeItem(LOGIN_PHONE_DRAFT_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

/**
 * @param {{ email?: string, countryDial?: string, termsAccepted?: boolean }} draft
 * @param {Storage|null} [storage]
 */
export function saveLoginPhoneDraft(draft, storage = browserSession()) {
  const email = String(draft?.email || '').trim();
  if (!email) {
    clearLoginPhoneDraft(storage);
    return;
  }
  const normalized = normalizeLoginPhoneDraft({
    email,
    countryDial: draft?.countryDial ?? '',
    termsAccepted: draft?.termsAccepted === true,
  });
  if (!normalized) return;
  memoryDraft = normalized;
  if (!storage) return;
  try {
    storage.setItem(LOGIN_PHONE_DRAFT_KEY, JSON.stringify(normalized));
  } catch {
    /* private mode / quota */
  }
}

/**
 * @param {Storage|null} [storage]
 */
export function clearLoginPhoneDraft(storage = browserSession()) {
  memoryDraft = null;
  if (!storage) return;
  try {
    storage.removeItem(LOGIN_PHONE_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
