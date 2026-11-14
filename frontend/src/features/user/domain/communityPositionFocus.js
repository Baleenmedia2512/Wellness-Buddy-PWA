/**
 * Ask the open app to show Profile on the Community Position field.
 */

const FOCUS_KEY = 'wv.focusCommunityPosition';
export const OPEN_COMMUNITY_POSITION_EVENT = 'wv:open-community-position';

export function requestCommunityPositionFill() {
  try {
    sessionStorage.setItem(FOCUS_KEY, '1');
  } catch {
    // Private mode can block storage. The profile page still opens.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OPEN_COMMUNITY_POSITION_EVENT));
  }
}

export function consumeCommunityPositionFill() {
  try {
    const pending = sessionStorage.getItem(FOCUS_KEY) === '1';
    if (pending) sessionStorage.removeItem(FOCUS_KEY);
    return pending;
  } catch {
    return false;
  }
}
