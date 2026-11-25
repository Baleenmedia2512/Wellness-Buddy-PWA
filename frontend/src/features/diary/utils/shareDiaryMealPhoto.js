/**
 * Diary meal share — always the meal photo itself (not a branded nutrition card).
 * List row, meal detail header, and FoodDetailModal all use this so WhatsApp
 * gets the same image wherever share is tapped in Diary.
 */

import { shareImageDirectly, composeBrandedShareCaption } from '../../../shared/utils/shareUtils';
import { withMarathonWhatsAppNotice } from '../../marathon';
import { ensureDailyWellnessScoreForShare } from '../../wellness-score-sheet/services/refreshDailyWellnessScoreNow';
import { fetchDiaryShareImageSrc } from './diaryThumbUrl';

/**
 * @param {object} opts
 * @param {{ kind?: string, imageUrl?: string|null, imageUrlFormat?: string|null, imagePath?: string|null }} opts.thumb
 * @param {string} [opts.title]
 * @param {string} [opts.shareText] activity caption (macros / items)
 * @param {object} [opts.shareUser] for branded WhatsApp suffix
 * @param {string} [opts.timezoneIana]
 * @param {string} [opts.fileName]
 * @param {string} [opts.fallbackImageSrc] used when thumb fetch yields only a template
 * @param {string} [opts.apiBaseUrl]
 */
export async function shareDiaryMealPhoto({
  thumb,
  title = 'My Meal',
  shareText = '',
  shareUser = null,
  timezoneIana,
  fileName,
  fallbackImageSrc = null,
  apiBaseUrl = process.env.REACT_APP_API_BASE_URL,
} = {}) {
  const isPlaceholder = (src) =>
    !src
    || String(src).includes('/emoji/')
    || String(src).endsWith('.svg');

  let photoSrc = await fetchDiaryShareImageSrc(thumb || {});
  if (isPlaceholder(photoSrc) && fallbackImageSrc && !isPlaceholder(fallbackImageSrc)) {
    const fromFallback = await fetchDiaryShareImageSrc({
      kind: thumb?.kind || 'food',
      imageUrl: fallbackImageSrc,
      imageUrlFormat: String(fallbackImageSrc).startsWith('http') ? 'raw' : 'data',
      imagePath: thumb?.imagePath || null,
    });
    if (fromFallback && !isPlaceholder(fromFallback)) photoSrc = fromFallback;
  }
  if (!photoSrc || isPlaceholder(photoSrc)) {
    throw new Error('No meal photo to share');
  }

  const wellnessScore = await ensureDailyWellnessScoreForShare({
    user: shareUser,
    timezoneSource: timezoneIana,
    apiBaseUrl,
  });

  const text = withMarathonWhatsAppNotice(
    composeBrandedShareCaption(shareText, { user: shareUser }),
    { user: shareUser, timezoneIana, wellnessScore },
  );

  await shareImageDirectly(photoSrc, {
    title,
    text,
    fileName: fileName || `wellness-meal-${Date.now()}.jpg`,
  });
}
