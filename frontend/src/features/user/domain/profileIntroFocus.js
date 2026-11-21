/**
 * Open Profile and highlight missing intro fields (from Digital Portfolio publish).
 */

const FOCUS_KEY = 'wv.focusProfileIntroFields';
export const OPEN_PROFILE_INTRO_EVENT = 'wv:open-profile-intro';

/** Publish modal labels → ProfileIntroFields keys. */
export const PROFILE_REQUIRED_LABEL_TO_KEY = Object.freeze({
  'About me': 'aboutMe',
  Languages: 'languages',
  'Professional title': 'professionalTitle',
  'Date of joining community': 'herbalifeJoinedOn',
});

/**
 * @param {unknown} labels
 * @returns {string[]}
 */
export function profileIntroKeysFromLabels(labels) {
  const list = Array.isArray(labels) ? labels : [];
  const keys = [];
  for (const label of list) {
    const key = PROFILE_REQUIRED_LABEL_TO_KEY[String(label || '').trim()];
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

/**
 * @param {string[]} fieldKeys
 */
export function requestProfileIntroFill(fieldKeys) {
  const keys = (Array.isArray(fieldKeys) ? fieldKeys : [])
    .map((k) => String(k || '').trim())
    .filter(Boolean);
  try {
    sessionStorage.setItem(FOCUS_KEY, JSON.stringify(keys));
  } catch {
    // Private mode can block storage. Profile still opens.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_PROFILE_INTRO_EVENT, { detail: { keys } }));
  }
}

/**
 * Read pending keys without clearing (Safe for React Strict Mode double-effects).
 * @returns {string[]}
 */
export function peekProfileIntroFill() {
  try {
    const raw = sessionStorage.getItem(FOCUS_KEY);
    if (raw == null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((k) => String(k || '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/** Clear after scroll/highlight applied. */
export function clearProfileIntroFill() {
  try {
    sessionStorage.removeItem(FOCUS_KEY);
  } catch {
    // ignore
  }
}

/**
 * @deprecated Prefer peek + clear after scroll. Kept for callers that already consume once.
 * @returns {string[]}
 */
export function consumeProfileIntroFill() {
  const keys = peekProfileIntroFill();
  if (keys.length) clearProfileIntroFill();
  return keys;
}

/**
 * DOM id for a Profile intro field (scroll / highlight target).
 * @param {string} key
 */
export function profileIntroFieldDomId(key) {
  return `profile-intro-${String(key || '').trim()}`;
}

/**
 * Scroll a field into view inside `.ios-scroll-body` (window scroll alone often no-ops).
 * @param {HTMLElement|null|undefined} el
 */
export function scrollProfileFieldIntoView(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return false;
  const scroller = typeof el.closest === 'function'
    ? el.closest('.ios-scroll-body')
    : null;
  if (scroller) {
    const elRect = el.getBoundingClientRect();
    const box = scroller.getBoundingClientRect();
    const nextTop = elRect.top - box.top + scroller.scrollTop - (box.height / 2) + (elRect.height / 2);
    if (typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
    } else {
      scroller.scrollTop = Math.max(0, nextTop);
    }
  }
  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  } catch {
    try {
      el.scrollIntoView(true);
    } catch {
      // ignore
    }
  }
  return true;
}
