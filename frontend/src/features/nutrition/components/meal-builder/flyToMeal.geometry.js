/** Pure geometry helpers for the fly-to-meal animation. */

export function rectCenter(rect) {
  if (!rect) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/** Fallback when the bottom tray is not mounted yet (first add). */
export function bottomTrayFallbackPoint(hostEl) {
  const host = hostEl?.getBoundingClientRect?.();
  if (host && host.width > 0) {
    return { x: host.left + host.width / 2, y: host.bottom - 56 };
  }
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  return { x: window.innerWidth / 2, y: window.innerHeight - 72 };
}

export function resolveFlyTargetPoint(targetEl, hostEl) {
  const target = targetEl?.getBoundingClientRect?.();
  if (target && target.width > 0 && target.height > 0) {
    return rectCenter(target);
  }
  return bottomTrayFallbackPoint(hostEl);
}
