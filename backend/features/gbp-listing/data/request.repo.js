/**
 * GBP listing requests — one row per (UserId, CenterId).
 */
import { getPrisma } from '../../../shared/lib/prisma.js';
import logger from '../../../shared/lib/logger.js';
import {
  GBP_STATUS,
  mediaFolderKeyFor,
  normalizeGbpFormFields,
  normalizeMediaFiles,
  normalizeWorkingDays,
} from '../domain/request.rules.js';

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS gbp_listing_requests_table (
  Id               BIGINT       NOT NULL AUTO_INCREMENT,
  UserId           BIGINT       NOT NULL,
  CenterId         BIGINT       NOT NULL,
  Status           VARCHAR(32)  NOT NULL DEFAULT 'draft',
  BusinessName     VARCHAR(160) NOT NULL DEFAULT '',
  PrimaryCategory  VARCHAR(80)  NOT NULL DEFAULT '',
  StreetAddress    VARCHAR(255) NOT NULL DEFAULT '',
  Landmark         VARCHAR(160) NOT NULL DEFAULT '',
  Area             VARCHAR(120) NOT NULL DEFAULT '',
  City             VARCHAR(120) NOT NULL DEFAULT '',
  State            VARCHAR(80)  NOT NULL DEFAULT 'Tamil Nadu',
  Pincode          VARCHAR(12)  NOT NULL DEFAULT '',
  ShowAddress      TINYINT(1)   NOT NULL DEFAULT 1,
  Phone            VARCHAR(32)  NOT NULL DEFAULT '',
  Whatsapp         VARCHAR(32)  NOT NULL DEFAULT '',
  WebsiteUrl       VARCHAR(320) NOT NULL DEFAULT '',
  WorkingDaysJson  TEXT         NULL,
  OpeningTime      VARCHAR(16)  NOT NULL DEFAULT '',
  ClosingTime      VARCHAR(16)  NOT NULL DEFAULT '',
  WeeklyHoliday    VARCHAR(40)  NOT NULL DEFAULT '',
  Description      VARCHAR(500) NOT NULL DEFAULT '',
  MediaFolderKey   VARCHAR(240) NOT NULL DEFAULT '',
  MediaFilesJson   LONGTEXT     NULL,
  MapsUrl          VARCHAR(500) NULL,
  OpsNote          TEXT         NULL,
  SubmittedAt      DATETIME     NULL,
  CompletedAt      DATETIME     NULL,
  CreatedAt        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (Id),
  UNIQUE KEY uq_gbp_listing_user_center (UserId, CenterId),
  KEY idx_gbp_listing_status (Status),
  KEY idx_gbp_listing_updated (UpdatedAt),
  KEY idx_gbp_listing_center (CenterId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const SELECT_COLS = `r.Id AS id, r.UserId AS userId, r.CenterId AS centerId, r.Status AS status,
  r.BusinessName AS businessName, r.PrimaryCategory AS primaryCategory,
  r.StreetAddress AS streetAddress, r.Landmark AS landmark, r.Area AS area,
  r.City AS city, r.State AS state, r.Pincode AS pincode, r.ShowAddress AS showAddress,
  r.Phone AS phone, r.Whatsapp AS whatsapp, r.WebsiteUrl AS websiteUrl,
  r.WorkingDaysJson AS workingDaysJson, r.OpeningTime AS openingTime,
  r.ClosingTime AS closingTime, r.WeeklyHoliday AS weeklyHoliday,
  r.Description AS description, r.MediaFolderKey AS mediaFolderKey,
  r.MediaFilesJson AS mediaFilesJson, r.MapsUrl AS mapsUrl, r.OpsNote AS opsNote,
  r.SubmittedAt AS submittedAt, r.CompletedAt AS completedAt, r.UpdatedAt AS updatedAt,
  t.UserName AS userName, nc.center_name AS centerName`;

let ensurePromise = null;

async function ensureSchema() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await getPrisma().$executeRawUnsafe(CREATE_TABLE_SQL);
    })().catch((error) => {
      ensurePromise = null;
      logger.warn('gbp_listing_requests_table could not be prepared', {
        message: error?.message || String(error),
      });
      throw error;
    });
  }
  return ensurePromise;
}

function mapRow(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    userId: Number(row.userId),
    centerId: Number(row.centerId),
    showAddress: !(row.showAddress === 0 || row.showAddress === false || row.showAddress === '0'),
    mediaFiles: normalizeMediaFiles(row.mediaFilesJson),
    workingDays: normalizeWorkingDays(row.workingDaysJson),
  };
}

export async function findById(id) {
  await ensureSchema();
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT ${SELECT_COLS}
     FROM gbp_listing_requests_table r
     LEFT JOIN team_table t ON t.UserId = r.UserId
     LEFT JOIN nutrition_centers_table nc ON nc.id = r.CenterId
     WHERE r.Id = ?
     LIMIT 1`,
    Number(id),
  );
  return mapRow(Array.isArray(rows) ? rows[0] : null);
}

export async function findByUserAndCenter(userId, centerId) {
  await ensureSchema();
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT ${SELECT_COLS}
     FROM gbp_listing_requests_table r
     LEFT JOIN team_table t ON t.UserId = r.UserId
     LEFT JOIN nutrition_centers_table nc ON nc.id = r.CenterId
     WHERE r.UserId = ? AND r.CenterId = ?
     LIMIT 1`,
    Number(userId),
    Number(centerId),
  );
  return mapRow(Array.isArray(rows) ? rows[0] : null);
}

export async function listByUserId(userId) {
  await ensureSchema();
  const rows = await getPrisma().$queryRawUnsafe(
    `SELECT ${SELECT_COLS}
     FROM gbp_listing_requests_table r
     LEFT JOIN team_table t ON t.UserId = r.UserId
     LEFT JOIN nutrition_centers_table nc ON nc.id = r.CenterId
     WHERE r.UserId = ?
     ORDER BY r.UpdatedAt DESC`,
    Number(userId),
  );
  return (Array.isArray(rows) ? rows : []).map(mapRow);
}

export async function listAll({ status = null, limit = 200 } = {}) {
  await ensureSchema();
  const lim = Math.min(Math.max(Number(limit) || 200, 1), 500);
  let rows;
  if (status) {
    rows = await getPrisma().$queryRawUnsafe(
      `SELECT ${SELECT_COLS}
       FROM gbp_listing_requests_table r
       LEFT JOIN team_table t ON t.UserId = r.UserId
       LEFT JOIN nutrition_centers_table nc ON nc.id = r.CenterId
       WHERE r.Status = ?
       ORDER BY r.UpdatedAt DESC
       LIMIT ${lim}`,
      String(status),
    );
  } else {
    rows = await getPrisma().$queryRawUnsafe(
      `SELECT ${SELECT_COLS}
       FROM gbp_listing_requests_table r
       LEFT JOIN team_table t ON t.UserId = r.UserId
       LEFT JOIN nutrition_centers_table nc ON nc.id = r.CenterId
       ORDER BY r.UpdatedAt DESC
       LIMIT ${lim}`,
    );
  }
  return (Array.isArray(rows) ? rows : []).map(mapRow);
}

/**
 * Create draft or update editable draft/needs_info fields.
 */
export async function upsertDraft({ userId, centerId, fields }) {
  await ensureSchema();
  const existing = await findByUserAndCenter(userId, centerId);
  const form = normalizeGbpFormFields(fields || {});
  const workingDaysJson = JSON.stringify(form.workingDays);

  if (existing) {
    await getPrisma().$executeRawUnsafe(
      `UPDATE gbp_listing_requests_table SET
        BusinessName = ?, PrimaryCategory = ?, StreetAddress = ?, Landmark = ?,
        Area = ?, City = ?, State = ?, Pincode = ?, ShowAddress = ?,
        Phone = ?, Whatsapp = ?, WebsiteUrl = ?, WorkingDaysJson = ?,
        OpeningTime = ?, ClosingTime = ?, WeeklyHoliday = ?, Description = ?,
        UpdatedAt = CURRENT_TIMESTAMP
       WHERE Id = ? AND UserId = ?`,
      form.businessName,
      form.primaryCategory,
      form.streetAddress,
      form.landmark,
      form.area,
      form.city,
      form.state,
      form.pincode,
      form.showAddress ? 1 : 0,
      form.phone,
      form.whatsapp,
      form.websiteUrl,
      workingDaysJson,
      form.openingTime,
      form.closingTime,
      form.weeklyHoliday,
      form.description,
      existing.id,
      Number(userId),
    );
    return findById(existing.id);
  }

  await getPrisma().$executeRawUnsafe(
    `INSERT INTO gbp_listing_requests_table (
      UserId, CenterId, Status, BusinessName, PrimaryCategory, StreetAddress, Landmark,
      Area, City, State, Pincode, ShowAddress, Phone, Whatsapp, WebsiteUrl,
      WorkingDaysJson, OpeningTime, ClosingTime, WeeklyHoliday, Description,
      MediaFolderKey, MediaFilesJson
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '[]')`,
    Number(userId),
    Number(centerId),
    GBP_STATUS.DRAFT,
    form.businessName,
    form.primaryCategory,
    form.streetAddress,
    form.landmark,
    form.area,
    form.city,
    form.state,
    form.pincode,
    form.showAddress ? 1 : 0,
    form.phone,
    form.whatsapp,
    form.websiteUrl,
    workingDaysJson,
    form.openingTime,
    form.closingTime,
    form.weeklyHoliday,
    form.description,
  );

  const created = await findByUserAndCenter(userId, centerId);
  if (!created) return null;
  const folder = mediaFolderKeyFor({ userId, requestId: created.id });
  await getPrisma().$executeRawUnsafe(
    `UPDATE gbp_listing_requests_table SET MediaFolderKey = ? WHERE Id = ?`,
    folder,
    created.id,
  );
  return findById(created.id);
}

export async function appendMediaFile({ requestId, userId, fileMeta }) {
  await ensureSchema();
  const row = await findById(requestId);
  if (!row || Number(row.userId) !== Number(userId)) return null;
  const files = [...normalizeMediaFiles(row.mediaFiles)];
  files.push({
    key: String(fileMeta.key),
    url: String(fileMeta.url || ''),
    mime: String(fileMeta.mime || ''),
    bytes: Number(fileMeta.bytes) || 0,
    originalName: String(fileMeta.originalName || ''),
    kind: fileMeta.kind === 'video' ? 'video' : 'photo',
  });
  const folder = row.mediaFolderKey
    || mediaFolderKeyFor({ userId: row.userId, requestId: row.id });
  await getPrisma().$executeRawUnsafe(
    `UPDATE gbp_listing_requests_table
     SET MediaFilesJson = ?, MediaFolderKey = ?, UpdatedAt = CURRENT_TIMESTAMP
     WHERE Id = ? AND UserId = ?`,
    JSON.stringify(files),
    folder,
    Number(requestId),
    Number(userId),
  );
  return findById(requestId);
}

export async function markSubmitted({ requestId, userId }) {
  await ensureSchema();
  await getPrisma().$executeRawUnsafe(
    `UPDATE gbp_listing_requests_table
     SET Status = ?, SubmittedAt = CURRENT_TIMESTAMP, UpdatedAt = CURRENT_TIMESTAMP, OpsNote = NULL
     WHERE Id = ? AND UserId = ?`,
    GBP_STATUS.SUBMITTED,
    Number(requestId),
    Number(userId),
  );
  return findById(requestId);
}

export async function adminUpdate({
  requestId,
  status,
  mapsUrl = null,
  opsNote = null,
}) {
  await ensureSchema();
  const completedAtSql = status === GBP_STATUS.LIVE
    ? ', CompletedAt = CURRENT_TIMESTAMP'
    : '';
  await getPrisma().$executeRawUnsafe(
    `UPDATE gbp_listing_requests_table
     SET Status = ?,
         MapsUrl = ?,
         OpsNote = ?,
         UpdatedAt = CURRENT_TIMESTAMP
         ${completedAtSql}
     WHERE Id = ?`,
    String(status),
    mapsUrl != null ? String(mapsUrl).trim().slice(0, 500) : null,
    opsNote != null ? String(opsNote) : null,
    Number(requestId),
  );
  return findById(requestId);
}
