/**
 * Anonymous public star ratings for published coach portfolio pages.
 */
import { getPrisma } from '../../../shared/lib/prisma.js';
import { formatPublicRatingSummary } from '../domain/public-rating.rules.js';

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS coach_portfolio_public_ratings_table (
  Id             BIGINT       NOT NULL AUTO_INCREMENT,
  SubmissionId   BIGINT       NOT NULL,
  PublicSlug     VARCHAR(160) NOT NULL,
  Rating         TINYINT      NOT NULL,
  RaterKey       VARCHAR(64)  NOT NULL,
  CreatedAt      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  UNIQUE KEY uq_portfolio_rating_submission_rater (SubmissionId, RaterKey),
  KEY idx_portfolio_rating_submission (SubmissionId),
  KEY idx_portfolio_rating_slug (PublicSlug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

let ensurePromise = null;

async function ensureSchema() {
  if (!ensurePromise) {
    ensurePromise = getPrisma().$executeRawUnsafe(CREATE_TABLE_SQL).catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  await ensurePromise;
}

/**
 * @param {number|string} submissionId
 * @returns {Promise<{ average: number, count: number, label: string } | null>}
 */
export async function getPublicRatingSummary(submissionId) {
  await ensureSchema();
  const id = Number(submissionId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT AVG(Rating) AS average, COUNT(*) AS count
     FROM coach_portfolio_public_ratings_table
     WHERE SubmissionId = ?`,
    id,
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  return formatPublicRatingSummary(row?.average, row?.count);
}

/**
 * Insert or update this visitor's rating for the page.
 * @param {{
 *   submissionId: number|string,
 *   publicSlug: string,
 *   raterKey: string,
 *   rating: number,
 * }} input
 * @returns {Promise<{ average: number, count: number, label: string } | null>}
 */
export async function upsertPublicRating({
  submissionId,
  publicSlug,
  raterKey,
  rating,
}) {
  await ensureSchema();
  const id = Number(submissionId);
  const slug = String(publicSlug || '').trim().toLowerCase();
  const key = String(raterKey || '').trim();
  const stars = Number(rating);
  if (!Number.isFinite(id) || id <= 0) {
    throw Object.assign(new Error('Invalid submission'), { status: 400 });
  }
  if (!slug || !key) {
    throw Object.assign(new Error('Invalid rater'), { status: 400 });
  }
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    throw Object.assign(new Error('Rating must be 1–5'), { status: 400 });
  }

  await getPrisma().$executeRawUnsafe(
    `INSERT INTO coach_portfolio_public_ratings_table
      (SubmissionId, PublicSlug, Rating, RaterKey)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       Rating = VALUES(Rating),
       PublicSlug = VALUES(PublicSlug),
       UpdatedAt = CURRENT_TIMESTAMP`,
    id,
    slug,
    stars,
    key,
  );

  return getPublicRatingSummary(id);
}
