/**
 * Coach portfolio form submissions — one row per (UserId, CenterId).
 * CenterId = nutrition_centers_table.id.
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
  CenterId      BIGINT       NULL,
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
  UNIQUE KEY uq_coach_portfolio_user_center (UserId, CenterId),
  UNIQUE KEY uq_coach_portfolio_slug (PublicSlug),
  KEY idx_coach_portfolio_submission_status (Status),
  KEY idx_coach_portfolio_submission_updated (UpdatedAt),
  KEY idx_coach_portfolio_center (CenterId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const SELECT_COLS = `s.Id AS id, s.UserId AS userId, s.CenterId AS centerId, s.Status AS status, s.FormJson AS formJson,
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
    if (!/duplicate|exists|1060|1061|1091|check that.+exists/i.test(msg)) throw error;
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
        'ALTER TABLE coach_portfolio_submissions_table ADD COLUMN CenterId BIGINT NULL AFTER UserId',
      );
      await runIgnoreDuplicate(
        'ALTER TABLE coach_portfolio_submissions_table DROP INDEX uq_coach_portfolio_submission_user',
      );
      await runIgnoreDuplicate(
        'ALTER TABLE coach_portfolio_submissions_table ADD UNIQUE KEY uq_coach_portfolio_user_center (UserId, CenterId)',
      );
      await runIgnoreDuplicate(
        'ALTER TABLE coach_portfolio_submissions_table ADD UNIQUE KEY uq_coach_portfolio_slug (PublicSlug)',
      );
      await runIgnoreDuplicate(
        'ALTER TABLE coach_portfolio_submissions_table ADD KEY idx_coach_portfolio_center (CenterId)',
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
    centerId: row.centerId != null ? Number(row.centerId) : null,
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

/**
 * One website for this user + nutrition center.
 */
export async function findSubmissionByUserAndCenter(userId, centerId) {
  await ensureSchema();
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT ${SELECT_COLS}
     FROM coach_portfolio_submissions_table s
     LEFT JOIN team_table t ON t.UserId = s.UserId
     WHERE s.UserId = ? AND s.CenterId = ?
     LIMIT 1`,
    Number(userId),
    Number(centerId),
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return mapRow(rows[0]);
}

/**
 * Legacy / admin helper: newest row for this user (any center).
 * Prefer findSubmissionByUserAndCenter.
 */
export async function findSubmissionByUserId(userId) {
  await ensureSchema();
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT ${SELECT_COLS}
     FROM coach_portfolio_submissions_table s
     LEFT JOIN team_table t ON t.UserId = s.UserId
     WHERE s.UserId = ?
     ORDER BY s.UpdatedAt DESC, s.Id DESC
     LIMIT 1`,
    Number(userId),
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function listSubmissionsByUserId(userId) {
  await ensureSchema();
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT ${SELECT_COLS}
     FROM coach_portfolio_submissions_table s
     LEFT JOIN team_table t ON t.UserId = s.UserId
     WHERE s.UserId = ?
     ORDER BY s.UpdatedAt DESC, s.Id DESC`,
    Number(userId),
  );
  return (Array.isArray(rows) ? rows : []).map(mapRow);
}

/** Attach a nutrition center to a legacy row that has CenterId NULL. */
export async function attachCenterIdToSubmission(submissionId, centerId) {
  await ensureSchema();
  const id = Number(submissionId);
  const cid = Number(centerId);
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(cid) || cid <= 0) {
    throw new Error('submissionId and centerId are required');
  }
  await getPrisma().$executeRawUnsafe(
    `UPDATE coach_portfolio_submissions_table
     SET CenterId = ?
     WHERE Id = ? AND CenterId IS NULL`,
    cid,
    id,
  );
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT ${SELECT_COLS}
     FROM coach_portfolio_submissions_table s
     LEFT JOIN team_table t ON t.UserId = s.UserId
     WHERE s.Id = ?
     LIMIT 1`,
    id,
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

/**
 * Published coach public paths for sitemap.xml (newest first).
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<Array<{ publicSlug: string, updatedAt: string|null }>>}
 */
export async function listPublishedPublicSlugs({ limit = 5000 } = {}) {
  await ensureSchema();
  const cap = Math.min(Math.max(Number(limit) || 5000, 1), 10000);
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT PublicSlug AS publicSlug, UpdatedAt AS updatedAt
     FROM coach_portfolio_submissions_table
     WHERE IsPublished = 1
       AND PublicSlug IS NOT NULL
       AND TRIM(PublicSlug) <> ''
     ORDER BY UpdatedAt DESC
     LIMIT ${cap}`,
  );
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      publicSlug: String(r.publicSlug || '').trim().toLowerCase(),
      updatedAt: r.updatedAt ?? null,
    }))
    .filter((r) => r.publicSlug && isValidCoachPublicSlug(r.publicSlug));
}

/** @deprecated use findPublishedByCityAndSlug */
export async function findPublishedBySlug(slug) {
  if (String(slug || '').includes('/')) {
    return findPublishedByPublicSlug(slug);
  }
  return null;
}

/** True when another submission row already owns this public slug. */
export async function slugTakenByOther(publicSlug, { userId, centerId, submissionId } = {}) {
  await ensureSchema();
  if (submissionId != null) {
    const rows = await getPrisma().$queryRawUnsafe(
      `SELECT Id AS id FROM coach_portfolio_submissions_table
       WHERE PublicSlug = ? AND Id <> ?
       LIMIT 1`,
      String(publicSlug),
      Number(submissionId),
    );
    return Array.isArray(rows) && rows.length > 0;
  }
  if (centerId != null) {
    const rows = await getPrisma().$queryRawUnsafe(
      `SELECT Id AS id FROM coach_portfolio_submissions_table
       WHERE PublicSlug = ? AND NOT (UserId = ? AND CenterId = ?)
       LIMIT 1`,
      String(publicSlug),
      Number(userId),
      Number(centerId),
    );
    return Array.isArray(rows) && rows.length > 0;
  }
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
 * True when another submission already uses this website display name (case-insensitive).
 */
export async function displayNameTakenByOther(displayName, userId, { centerId } = {}) {
  await ensureSchema();
  const name = String(displayName || '').trim().toLowerCase();
  if (!name) return false;
  if (centerId != null) {
    const rows = await getPrisma().$queryRawUnsafe(
      `SELECT UserId AS userId FROM coach_portfolio_submissions_table
       WHERE NOT (UserId = ? AND CenterId = ?)
         AND LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(FormJson, '$.mediaBrand.websiteDisplayName')))) = ?
       LIMIT 1`,
      Number(userId),
      Number(centerId),
      name,
    );
    return Array.isArray(rows) && rows.length > 0;
  }
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
 * Rebuild PublicSlug from FormJson for one submission row.
 * Prefer submissionId for freestyle (CenterId NULL) so we never rewrite another site.
 */
export async function assignPublicSlug(userId, {
  centerId,
  submissionId = null,
  markPublished = false,
} = {}) {
  await ensureSchema();
  let row = null;
  if (submissionId != null) {
    row = await findSubmissionById(submissionId);
    if (row && Number(row.userId) !== Number(userId)) row = null;
  }
  if (!row && centerId != null) {
    row = await findSubmissionByUserAndCenter(userId, centerId);
  }
  if (!row) {
    row = await findLatestNullCenterSubmission(userId)
      || await findSubmissionByUserId(userId);
  }
  if (!row) return null;

  const form = row.formJson || {};
  let publicSlug = buildCoachPortfolioPath({
    websiteDisplayName: form.mediaBrand?.websiteDisplayName,
    fullName: form.personal?.fullName || row.userName,
    city: form.center?.city,
    locality: form.center?.locality,
    userId,
  }).publicSlug;

  if (await slugTakenByOther(publicSlug, {
    userId,
    centerId: row.centerId,
    submissionId: row.id,
  })) {
    const parsed = publicSlug.split('/');
    const city = parsed[0] || 'india';
    const area = parsed[1] || 'center';
    const leaf = `${parsed[2] || 'coach'}-${userId}-${row.centerId || row.id}`.slice(0, 48);
    publicSlug = `${city}/${area}/${leaf}`.slice(0, 160);
  }

  if (markPublished || row.isPublished) {
    await getPrisma().$executeRawUnsafe(
      `UPDATE coach_portfolio_submissions_table
       SET PublicSlug = ?, IsPublished = 1
       WHERE Id = ?`,
      publicSlug,
      Number(row.id),
    );
  } else {
    await getPrisma().$executeRawUnsafe(
      `UPDATE coach_portfolio_submissions_table
       SET PublicSlug = ?
       WHERE Id = ?`,
      publicSlug,
      Number(row.id),
    );
  }
  return findSubmissionById(row.id);
}

export async function publishSubmission(userId, { centerId, submissionId = null } = {}) {
  return assignPublicSlug(userId, { centerId, submissionId, markPublished: true });
}

export async function unpublishSubmission(userId, { centerId } = {}) {
  await ensureSchema();
  if (centerId != null) {
    await getPrisma().$executeRawUnsafe(
      `UPDATE coach_portfolio_submissions_table
       SET IsPublished = 0
       WHERE UserId = ? AND CenterId = ?`,
      Number(userId),
      Number(centerId),
    );
    return findSubmissionByUserAndCenter(userId, centerId);
  }
  await getPrisma().$executeRawUnsafe(
    `UPDATE coach_portfolio_submissions_table
     SET IsPublished = 0
     WHERE UserId = ?`,
    Number(userId),
  );
  return findSubmissionByUserId(userId);
}

async function findLatestNullCenterSubmission(userId) {
  await ensureSchema();
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT ${SELECT_COLS}
     FROM coach_portfolio_submissions_table s
     LEFT JOIN team_table t ON t.UserId = s.UserId
     WHERE s.UserId = ? AND s.CenterId IS NULL
     ORDER BY s.UpdatedAt DESC, s.Id DESC
     LIMIT 1`,
    Number(userId),
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function findSubmissionById(submissionId) {
  await ensureSchema();
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT ${SELECT_COLS}
     FROM coach_portfolio_submissions_table s
     LEFT JOIN team_table t ON t.UserId = s.UserId
     WHERE s.Id = ?
     LIMIT 1`,
    Number(submissionId),
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return mapRow(rows[0]);
}

/**
 * Upsert one website row.
 * - With centerId: one row per (UserId, CenterId)
 * - Without centerId: freestyle site (City/Area typed manually). createNew inserts a new NULL-center row.
 */
export async function upsertSubmission({
  userId,
  centerId = null,
  status,
  form,
  markSubmitted = false,
  clearReview = false,
  createNew = false,
  submissionId = null,
}) {
  await ensureSchema();
  const formJson = JSON.stringify(normalizeFormJson(form));
  const cid = centerId != null && String(centerId).trim() !== ''
    ? Number(centerId)
    : null;
  const hasCenter = Number.isFinite(cid) && cid > 0;

  if (hasCenter) {
    const existing = await findSubmissionByUserAndCenter(userId, cid);
    if (!existing) {
      await getPrisma().$executeRawUnsafe(
        `INSERT INTO coach_portfolio_submissions_table
           (UserId, CenterId, Status, FormJson, SubmittedAt)
         VALUES (?, ?, ?, ?, ${markSubmitted ? 'UTC_TIMESTAMP()' : 'NULL'})`,
        Number(userId),
        cid,
        String(status),
        formJson,
      );
    } else if (markSubmitted) {
      await getPrisma().$executeRawUnsafe(
        `UPDATE coach_portfolio_submissions_table
         SET Status = ?, FormJson = ?, SubmittedAt = UTC_TIMESTAMP(),
             ReviewedAt = NULL, ReviewedBy = NULL
         WHERE UserId = ? AND CenterId = ?`,
        String(status),
        formJson,
        Number(userId),
        cid,
      );
    } else if (clearReview) {
      await getPrisma().$executeRawUnsafe(
        `UPDATE coach_portfolio_submissions_table
         SET Status = ?, FormJson = ?, ReviewedAt = NULL, ReviewedBy = NULL
         WHERE UserId = ? AND CenterId = ?`,
        String(status),
        formJson,
        Number(userId),
        cid,
      );
    } else {
      await getPrisma().$executeRawUnsafe(
        `UPDATE coach_portfolio_submissions_table
         SET Status = ?, FormJson = ?
         WHERE UserId = ? AND CenterId = ?`,
        String(status),
        formJson,
        Number(userId),
        cid,
      );
    }
    return findSubmissionByUserAndCenter(userId, cid);
  }

  // Freestyle (no nutrition center): City/Area come from the form.
  let existing = null;
  if (submissionId != null) {
    existing = await findSubmissionById(submissionId);
    if (existing && Number(existing.userId) !== Number(userId)) existing = null;
  }
  if (!existing && !createNew) {
    existing = await findLatestNullCenterSubmission(userId);
  }

  if (!existing || createNew) {
    await getPrisma().$executeRawUnsafe(
      `INSERT INTO coach_portfolio_submissions_table
         (UserId, CenterId, Status, FormJson, SubmittedAt)
       VALUES (?, NULL, ?, ?, ${markSubmitted ? 'UTC_TIMESTAMP()' : 'NULL'})`,
      Number(userId),
      String(status),
      formJson,
    );
    return findLatestNullCenterSubmission(userId);
  }

  if (markSubmitted) {
    await getPrisma().$executeRawUnsafe(
      `UPDATE coach_portfolio_submissions_table
       SET Status = ?, FormJson = ?, SubmittedAt = UTC_TIMESTAMP(),
           ReviewedAt = NULL, ReviewedBy = NULL
       WHERE Id = ?`,
      String(status),
      formJson,
      Number(existing.id),
    );
  } else if (clearReview) {
    await getPrisma().$executeRawUnsafe(
      `UPDATE coach_portfolio_submissions_table
       SET Status = ?, FormJson = ?, ReviewedAt = NULL, ReviewedBy = NULL
       WHERE Id = ?`,
      String(status),
      formJson,
      Number(existing.id),
    );
  } else {
    await getPrisma().$executeRawUnsafe(
      `UPDATE coach_portfolio_submissions_table
       SET Status = ?, FormJson = ?
       WHERE Id = ?`,
      String(status),
      formJson,
      Number(existing.id),
    );
  }
  return findSubmissionById(existing.id);
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
  centerId,
  status,
  adminNote = null,
  reviewedBy,
}) {
  await ensureSchema();
  if (centerId != null) {
    await getPrisma().$executeRawUnsafe(
      `UPDATE coach_portfolio_submissions_table
       SET Status = ?,
           AdminNote = ?,
           ReviewedAt = UTC_TIMESTAMP(),
           ReviewedBy = ?
       WHERE UserId = ? AND CenterId = ?`,
      String(status),
      adminNote != null ? String(adminNote) : null,
      Number(reviewedBy),
      Number(userId),
      Number(centerId),
    );
    return findSubmissionByUserAndCenter(userId, centerId);
  }
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
