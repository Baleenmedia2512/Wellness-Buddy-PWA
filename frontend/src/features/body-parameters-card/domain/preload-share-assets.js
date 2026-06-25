/**
 * preload-share-assets.js — warm browser cache for body-params share card images.
 * Call when the form opens so html2canvas does not wait on first paint.
 */

export const BODY_PARAMS_SHARE_ASSETS = ['/bg.png', '/logo.png', '/flower-icon.png'];

/** @returns {void} */
export function preloadBodyParamsShareAssets() {
  BODY_PARAMS_SHARE_ASSETS.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}
