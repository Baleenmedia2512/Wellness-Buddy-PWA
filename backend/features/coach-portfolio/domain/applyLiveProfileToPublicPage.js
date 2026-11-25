/**
 * Overlay live app profile intro onto the public portfolio view-model.
 * Name / photo are handled by SSR callers; this covers title + about.
 */
import { shortPublicText } from './public-copy.rules.js';

/**
 * @param {object} page
 * @param {{
 *   professionalTitle?: string|null,
 *   aboutMe?: string|null,
 * }|null} intro
 * @returns {object}
 */
export function applyLiveProfileToPublicPage(page, intro) {
  if (!page || !intro || typeof intro !== 'object') return page;

  const title = String(intro.professionalTitle || '').trim();
  if (title) page.title = title;

  const about = String(intro.aboutMe || '').trim();
  if (about) page.background = shortPublicText(about, 360);

  return page;
}
