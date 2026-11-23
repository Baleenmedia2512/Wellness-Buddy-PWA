/**
 * Public (unauthenticated) star rating submit for published coach pages.
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import * as submissionRepo from '../data/submission.repo.js';
import * as ratingRepo from '../data/public-rating.repo.js';
import {
  buildPublicRaterKey,
  clampPublicStarRating,
} from '../domain/public-rating.rules.js';
import { canShowPublicPortfolio } from '../domain/public-page.rules.js';
import { isValidCoachPublicSlug } from '../domain/slug.rules.js';
import { PORTFOLIO_FLAG } from '../domain/access.rules.js';

function clientIp(req) {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  if (forwarded) return forwarded;
  return String(req?.socket?.remoteAddress || req?.connection?.remoteAddress || '').trim();
}

/**
 * POST body: { publicSlug, rating }
 */
export async function submitPublicPortfolioRating(req) {
  if (!isEnabled(PORTFOLIO_FLAG)) {
    throw new ValidationError(404, 'Coach Website is not available');
  }

  const publicSlug = String(req?.body?.publicSlug || '').trim().toLowerCase();
  const rating = clampPublicStarRating(req?.body?.rating);
  if (!isValidCoachPublicSlug(publicSlug)) {
    throw new ValidationError(400, 'Invalid page');
  }
  if (rating == null) {
    throw new ValidationError(400, 'Choose a rating from 1 to 5 stars');
  }

  const row = await submissionRepo.findPublishedByPublicSlug(publicSlug);
  if (!row || !canShowPublicPortfolio(row)) {
    throw new ValidationError(404, 'Page not found');
  }

  const raterKey = buildPublicRaterKey({
    ip: clientIp(req),
    userAgent: req?.headers?.['user-agent'],
    publicSlug,
  });
  if (!raterKey) {
    throw new ValidationError(400, 'Unable to record rating');
  }

  const summary = await ratingRepo.upsertPublicRating({
    submissionId: row.id,
    publicSlug: row.publicSlug || publicSlug,
    raterKey,
    rating,
  });

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        rating,
        summary,
      },
    },
  };
}
