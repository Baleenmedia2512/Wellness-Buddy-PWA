/**
 * Coach portfolio form submissions. Ensured on first use (same pattern as access table).
 */
import { getPrisma } from '../../../shared/lib/prisma.js';
import logger from '../../../shared/lib/logger.js';
import { SUBMISSION_STATUS, normalizeFormJson } from '../domain/submission.rules.js';
import {
  buildCoachPortfolioPath,
  isValidCoachPublicSlug,
  isValidCoachSlug,
} from '../domain/slug.rules.js';

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS coach_portfolio_submissions_table (
  Id            BIGINT       NOT NULL AUTO_INCREMENT,
  UserId        BIGINT       NOT NULL,
  Status        VARCHAR(32)  NOT NULL DEFAULT 'draft',
  FormJson      LONGTEXT     NOT NULL,
  AdminNote     TEXT         NULL,
  PublicSlug    VARCHAR(160) NULL,
  IsPublished   TINYINT(1)   NOT NULL DEFAULT 0,
  SubmittedAt   DATETIME     NULL,
  ReviewedAt    DATETIME     NULL,
  ReviewedBy    BIGINT       NULL,
  CreatedAt     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  UNIQUE KEY uq_coach_portfolio_submission_user (UserId),
  UNIQUE KEY uq_coach_portfolio_slug (PublicSlug),
  KEY idx_coach_portfolio_submission_status (Status),
  KEY idx_coach_portfolio_submission_updated (UpdatedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const SELECT_COLS = `s.Id AS id, s.UserId AS userId, s.Status AS status, s.FormJson AS formJson,
            s.AdminNote AS adminNote, s.PublicSlug AS publicSlug, s.IsPublished AS isPublished,
            s.SubmittedAt AS submittedAt, s.ReviewedAt AS reviewedAt,
            s.ReviewedBy AS reviewedBy, s.UpdatedAt AS updatedAt,
            t.UserName AS userName`;

let ensurePromise = null;

async function runIgnoreDuplicate(sql) {
  try {
    await getPrisma().$executeRawUnsafe(sql);
  } catch (error) {
    const msg = error?.message || String(error);
    if (!/duplicate|exists|1060|1061/i.test(msg)) throw error;
  }
}

async function ensureSchema() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await getPrisma().$executeRawUnsafe(CREATE_TABLE_SQL);
      await runIgnoreDuplicate(
        'ALTER TABLE coach_portfolio_submissions_table ADD COLUMN PublicSlug VARCHAR(160) NULL',
      );
      await runIgnoreDuplicate(
        'ALTER TABLE coach_portfolio_submissions_table ADD COLUMN IsPublished TINYINT(1) NOT NULL DEFAULT 0',
      );
      await runIgnoreDuplicate(
        'ALTER TABLE coach_portfolio_submissions_table ADD UNIQUE KEY uq_coach_portfolio_slug (PublicSlug)',
      );
    })().catch((error) => {
      ensurePromise = null;
      logger.warn('coach_portfolio_submissions_table could not be prepared', {
        message: error?.message || String(error),
      });
      throw error;
    });
  }
  return ensurePromise;
}

function mapRow(row) {
  if (!row) return null;
  let formJson = {};
  try {
    formJson = typeof row.formJson === 'string'
      ? JSON.parse(row.formJson || '{}')
      : (row.formJson || {});
  } catch {
    formJson = {};
  }
  return {
    id: Number(row.id),
    userId: Number(row.userId),
    userName: row.userName != null ? String(row.userName) : null,
    status: String(row.status || SUBMISSION_STATUS.DRAFT),
    formJson: normalizeFormJson(formJson),
    adminNote: row.adminNote ?? null,
    publicSlug: row.publicSlug ? String(row.publicSlug) : null,
    isPublished: Number(row.isPublished) === 1,
    submittedAt: row.submittedAt ?? null,
    reviewedAt: row.reviewedAt ?? null,
    reviewedBy: row.reviewedBy != null ? Number(row.reviewedBy) : null,
    updatedAt: row.updatedAt ?? null,
  };
}

export async function findSubmissionByUserId(userId) {
  await ensureSchema();
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT ${SELECT_COLS}
     FROM coach_portfolio_submissions_table s
     LEFT JOIN team_table t ON t.UserId = s.UserId
     WHERE s.UserId = ?
     LIMIT 1`,
    Number(userId),
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return mapRow(rows[0]);
}

/**
 * @param {string[]} segments  city/area/name (v2) or city/name-area (v1)
 */
export async function findPublishedBySlugParts(segments) {
  await ensureSchema();
  const parts = (Array.isArray(segments) ? segments : [])
    .map((p) => String(p || '').trim().toLowerCase())
    .filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => isValidCoachSlug(p))) return null;
  return findPublishedByPublicSlug(parts.join('/'));
}

/**
 * @param {string} citySlug
 * @param {string} pageSlug  legacy name-area segment
 * @deprecated Prefer findPublishedBySlugParts
 */
export async function findPublishedByCityAndSlug(citySlug, pageSlug) {
  return findPublishedBySlugParts([citySlug, pageSlug]);
}

export async function findPublishedByPublicSlug(publicSlug) {
  await ensureSchema();
  if (!isValidCoachPublicSlug(publicSlug)) return null;
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT ${SELECT_COLS}
     FROM coach_portfolio_submissions_table s
     LEFT JOIN team_table t ON t.UserId = s.UserId
     WHERE s.PublicSlug = ? AND s.IsPublished = 1
     LIMIT 1`,
    String(publicSlug).toLowerCase(),
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return mapRow(rows[0]);
}

/** @deprecated use findPublishedByCityAndSlug */
export async function findPublishedBySlug(slug) {
  if (String(slug || '').includes('/')) {
    return findPublishedByPublicSlug(slug);
  }
  return null;
}

export async function slugTakenByOther(publicSlug, userId) {
  await ensureSchema();
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT UserId AS userId FROM coach_portfolio_submissions_table
     WHERE PublicSlug = ? AND UserId <> ?
     LIMIT 1`,
    String(publicSlug),
    Number(userId),
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * True when another coach already uses this website display name (case-insensitive).
 * @param {string} displayName
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
export async function displayNameTakenByOther(displayName, userId) {
  await ensureSchema();
  const name = String(displayName || '').trim().toLowerCase();
  if (!name) return false;
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT UserId AS userId FROM coach_portfolio_submissions_table
     WHERE UserId <> ?
       AND LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(FormJson, '$.mediaBrand.websiteDisplayName')))) = ?
     LIMIT 1`,
    Number(userId),
    name,
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Rebuild PublicSlug from FormJson:
 *   /coach/<city>/<area>/<website-display-name>
 * @param {number} userId
 * @param {{ markPublished?: boolean }} [opts]
 */
export async function assignPublicSlug(userId, { markPublished = false } = {}) {
  await ensureSchema();
  const row = await findSubmissionByUserId(userId);
  if (!row) return null;

  const form = row.formJson || {};
  let publicSlug = buildCoachPortfolioPath({
    websiteDisplayName: form.mediaBrand?.websiteDisplayName,
    fullName: form.personal?.fullName || row.userName,
    city: form.center?.city,
    locality: form.center?.locality,
    userId,
  }).publicSlug;

  if (await slugTakenByOther(publicSlug, userId)) {
    const parsed = publicSlug.split('/');
    const city = parsed[0] || 'india';
    const area = parsed[1] || 'center';
    const leaf = `${parsed[2] || 'coach'}-${userId}`.slice(0, 48);
    publicSlug = `${city}/${area}/${leaf}`.slice(0, 160);
  }

  if (markPublished || row.isPublished) {
    await getPrisma().$executeRawUnsafe(
      `UPDATE coach_portfolio_submissions_table
       SET PublicSlug = ?, IsPublished = 1
       WHERE UserId = ?`,
      publicSlug,
      Number(userId),
    );
  } else {
    await getPrisma().$executeRawUnsafe(
      `UPDATE coach_portfolio_submissions_table
       SET PublicSlug = ?
       WHERE UserId = ?`,
      publicSlug,
      Number(userId),
    );
  }
  return findSubmissionByUserId(userId);
}

/**
 * Assign a unique /coach/<city>/<area>/<website-display-name> slug and mark published.
 * Always rebuilds from current FormJson so city / area / display name stay in sync.
 */
export async function publishSubmission(userId) {
  return assignPublicSlug(userId, { markPublished: true });
}

export async function unpublishSubmission(userId) {
  await ensureSchema();
  await getPrisma().$executeRawUnsafe(
    `UPDATE coach_portfolio_submissions_table
     SET IsPublished = 0
     WHERE UserId = ?`,
    Number(userId),
  );
  return findSubmissionByUserId(userId);
}

export async function upsertSubmission({
  userId,
  status,
  form,
  markSubmitted = false,
  clearReview = false,
}) {
  await ensureSchema();
  const formJson = JSON.stringify(normalizeFormJson(form));
  const existing = await findSubmissionByUserId(userId);

  if (!existing) {
    await getPrisma().$executeRawUnsafe(
      `INSERT INTO coach_portfolio_submissions_table
         (UserId, Status, FormJson, SubmittedAt)
       VALUES (?, ?, ?, ${markSubmitted ? 'UTC_TIMESTAMP()' : 'NULL'})`,
      Number(userId),
      String(status),
      formJson,
    );
  } else if (markSubmitted) {
    await getPrisma().$executeRawUnsafe(
      `UPDATE coach_portfolio_submissions_table
       SET Status = ?, FormJson = ?, SubmittedAt = UTC_TIMESTAMP(),
           ReviewedAt = NULL, ReviewedBy = NULL
       WHERE UserId = ?`,
      String(status),
      formJson,
      Number(userId),
    );
  } else if (clearReview) {
    await getPrisma().$executeRawUnsafe(
      `UPDATE coach_portfolio_submissions_table
       SET Status = ?, FormJson = ?, ReviewedAt = NULL, ReviewedBy = NULL
       WHERE UserId = ?`,
      String(status),
      formJson,
      Number(userId),
    );
  } else {
    await getPrisma().$executeRawUnsafe(
      `UPDATE coach_portfolio_submissions_table
       SET Status = ?, FormJson = ?
       WHERE UserId = ?`,
      String(status),
      formJson,
      Number(userId),
    );
  }

  return findSubmissionByUserId(userId);
}

export async function listSubmissions({ status = null, limit = 100 } = {}) {
  await ensureSchema();
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 200);
  let rows;
  if (status) {
    rows = await getPrisma().$queryRawUnsafe(
      `SELECT ${SELECT_COLS}
       FROM coach_portfolio_submissions_table s
       LEFT JOIN team_table t ON t.UserId = s.UserId
       WHERE s.Status = ?
       ORDER BY s.UpdatedAt DESC
       LIMIT ${lim}`,
      String(status),
    );
  } else {
    rows = await getPrisma().$queryRawUnsafe(
      `SELECT ${SELECT_COLS}
       FROM coach_portfolio_submissions_table s
       LEFT JOIN team_table t ON t.UserId = s.UserId
       ORDER BY s.UpdatedAt DESC
       LIMIT ${lim}`,
    );
  }
  return (Array.isArray(rows) ? rows : []).map(mapRow);
}

export async function updateSubmissionStatus({
  userId,
  status,
  adminNote = null,
  reviewedBy,
}) {
  await ensureSchema();
  await getPrisma().$executeRawUnsafe(
    `UPDATE coach_portfolio_submissions_table
     SET Status = ?,
         AdminNote = ?,
         ReviewedAt = UTC_TIMESTAMP(),
         ReviewedBy = ?
     WHERE UserId = ?`,
    String(status),
    adminNote != null ? String(adminNote) : null,
    Number(reviewedBy),
    Number(userId),
  );
  return findSubmissionByUserId(userId);
}
