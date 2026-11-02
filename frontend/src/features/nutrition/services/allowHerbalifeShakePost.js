/**
 * Gate a Herbalife Shake save: ask when one was already posted within an hour.
 * Returns true when the save may continue. Lookup errors fail open.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { DEFAULT_BUSINESS_TIMEZONE } from '../../../shared/utils/datetimeUtils';
import { isHerbalifeShakeAnalysis } from '../domain/herbalifeShakeRepost.rules.js';
import { findRecentHerbalifeShakePost } from './herbalifeShakeRepostCheck.js';
import HerbalifeShakeRepostModal from '../components/HerbalifeShakeRepostModal.jsx';

function promptHerbalifeShakeRepost({ loggedAt, timezoneIana }) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.setAttribute('data-herbalife-shake-repost', '1');
    document.body.appendChild(host);
    const root = createRoot(host);
    let settled = false;
    const close = (accepted) => {
      if (settled) return;
      settled = true;
      root.unmount();
      host.remove();
      resolve(accepted === true);
    };
    root.render(
      <HerbalifeShakeRepostModal
        loggedAt={loggedAt}
        timezoneIana={timezoneIana}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />,
    );
  });
}

/**
 * @param {{
 *   userId?: string|number|null,
 *   analysisResult?: object|null,
 *   timezoneIana?: string,
 * }} input
 * @returns {Promise<boolean>}
 */
export async function allowHerbalifeShakePost({
  userId,
  analysisResult,
  timezoneIana = DEFAULT_BUSINESS_TIMEZONE,
} = {}) {
  if (!isHerbalifeShakeAnalysis(analysisResult)) return true;
  if (userId == null || userId === '') return true;

  let recent = null;
  try {
    recent = await findRecentHerbalifeShakePost({ userId, timezoneIana });
  } catch (err) {
    console.warn('[Herbalife shake] recent-post check failed, continuing', err?.message || err);
    return true;
  }
  if (!recent?.loggedAt) return true;
  return promptHerbalifeShakeRepost({ loggedAt: recent.loggedAt, timezoneIana });
}
