/**
 * Main-nav pages that stay mounted after first visit.
 * Switching tabs must not remount — preserves scroll, search, filters, pagination.
 *
 * Exclusive overlays (profile, manual-entry, wellness-score, admin, activity-time-report)
 * are NOT in this set; they still mount/unmount normally on top.
 *
 * IMPORTANT: do NOT hide with `display: none`. iOS WKWebView / Chrome reset
 * `overflow` scrollTop on display-none → visible, so Diary jumps back to top.
 * Use visibility + absolute off-flow instead.
 */

export const NAV_KEEP_ALIVE_PAGES = Object.freeze([
  'dashboard',
  'counselling',
  'enrollment',
  'physical-club',
  'activity-report',
  'testimonials',
  'events',
  'broadcast',
  'create-event',
  'event-check-in',
  'paid-features',
  'map-business',
  'reports',
]);

const KEEP_ALIVE_SET = new Set(NAV_KEEP_ALIVE_PAGES);

export function isNavKeepAlivePage(pageId) {
  return KEEP_ALIVE_SET.has(pageId);
}

/**
 * Inline style for a keep-alive panel.
 * Active: normal document flow. Inactive: hidden but still laid out in memory
 * so `.ios-scroll-body` scrollTop survives tab switches.
 */
export function keepAlivePanelStyle(activeOverlayPage, pageId) {
  const active = isKeepAlivePanelActive(activeOverlayPage, pageId);
  if (active) {
    return {
      visibility: 'visible',
      pointerEvents: 'auto',
      position: 'relative',
      zIndex: 2,
    };
  }
  return {
    visibility: 'hidden',
    pointerEvents: 'none',
    position: 'absolute',
    inset: 0,
    zIndex: 0,
  };
}

export function isKeepAlivePanelActive(activeOverlayPage, pageId) {
  if (pageId === 'create-event') {
    return (
      activeOverlayPage === 'create-event'
      || activeOverlayPage === 'event-check-in'
    );
  }
  return activeOverlayPage === pageId;
}

export function keepAlivePanelHidden(activeOverlayPage, pageId) {
  return !isKeepAlivePanelActive(activeOverlayPage, pageId);
}
