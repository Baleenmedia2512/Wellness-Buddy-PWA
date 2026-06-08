/**
 * Weight feature — service layer.
 * All business logic lives here. No HTTP, no DB calls (only via repository).
 */
import {
  getISTTimestamp,
  convertToIST,
} from '../../utils/supabaseClient.js';
import { validateAndCorrectWeight } from '../../utils/weightValidation.js';
import { touchUserActivity, invalidateUserProfileCache } from '../../shared/lib/userActivity.js';
import * as repo from './weight.repository.js';
// PR 6 — captures_table is canonical for the at-capture-time write. The
// weight save endpoint promotes the linked capture pending → weight when
// `captureId` is supplied. Best-effort: a captures-side failure is logged
// and does NOT fail the user's weight save.
import * as captures from '../captures/captures.service.js';
import { IMAGE_TYPE_WEIGHT } from '../captures/domain/image-types.js';
import logger from '../../shared/lib/logger.js';

function toNumberOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function deriveCreatedAt(clientTimestamp) {
  if (!clientTimestamp) return getISTTimestamp();
  return convertToIST(clientTimestamp).istTimestamp;
}

function formatRow(row) {
  if (!(row.CreatedAt instanceof Date)) return row;
  const d = row.CreatedAt;
  const pad = (n) => String(n).padStart(2, '0');
  return {
    ...row,
    CreatedAt:
      d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()),
  };
}

function buildStats(rows) {
  const weights = rows.map(r => parseFloat(r.Weight)).filter(w => !isNaN(w));
  const stats = {
    totalEntries: rows.length,
    latestWeight: null,
    previousWeight: null,
    weightChange: null,
    averageWeight: weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : null,
    minWeight: weights.length ? Math.min(...weights) : null,
    maxWeight: weights.length ? Math.max(...weights) : null,
  };
  if (rows.length > 0) {
    stats.latestWeight = { value: parseFloat(rows[0].Weight), date: rows[0].CreatedAt };
    if (rows.length > 1) {
      stats.previousWeight = { value: parseFloat(rows[1].Weight), date: rows[1].CreatedAt };
      stats.weightChange = parseFloat(rows[0].Weight) - parseFloat(rows[1].Weight);
    }
  }
  return stats;
}

export async function saveWeight(input) {
  const {
    userId, weight, unit,
    bmi, bodyFat, muscleMass, bmr,
    imageBase64ToSave: rawImage,
    clientTimestamp, entryId,
    captureId,
    city, village,
    centerName, nutritionCenterId, attendanceType,
    latitude, longitude,
  } = input;

  const bmiValue = toNumberOrNull(bmi);
  const bodyFatValue = toNumberOrNull(bodyFat);
  const muscleMassValue = toNumberOrNull(muscleMass);
  const bmrValue = toNumberOrNull(bmr);
  const imageBase64ToSave = rawImage && rawImage.trim() !== '' ? rawImage : null;

  // BMR sync runs FIRST so it persists even if weight validation later fails.
  if (bmrValue) await repo.syncBmrToTeamTable(userId, bmrValue);

  // Weight validation against previous entry
  let lastEntry = await repo.findPreviousEntry(userId, entryId);
  if (!lastEntry && entryId) lastEntry = await repo.findEntryById(entryId);

  let correctionInfo = null;
  if (lastEntry?.Weight) {
    const validation = validateAndCorrectWeight(
      weight, parseFloat(lastEntry.Weight), lastEntry.CreatedAt, unit
    );
    if (validation.wasCorrected || validation.message) {
      correctionInfo = {
        originalWeight: validation.originalWeight,
        correctedWeight: validation.finalWeight,
        wasCorrected: validation.wasCorrected && !entryId,
        message: validation.message,
        previousWeight: parseFloat(lastEntry.Weight),
      };
    }
  }

  const createdAtIST = deriveCreatedAt(clientTimestamp);
  const currentTime = getISTTimestamp();

  let data;
  let wasUpdated = false;

  if (entryId) {
    const updates = { Weight: weight };
    if (bmiValue !== null) updates.Bmi = bmiValue;
    if (bodyFatValue !== null) updates.BodyFat = bodyFatValue;
    if (muscleMassValue !== null) updates.MuscleMass = muscleMassValue;
    if (bmrValue !== null) updates.Bmr = bmrValue;
    if (imageBase64ToSave !== null) updates.WeightImageBase64 = imageBase64ToSave;
    data = await repo.updateEntry(entryId, userId, updates);
    if (!data) return { httpStatus: 403, body: { success: false, message: 'Entry not found or unauthorized' } };
    wasUpdated = true;
  } else {
    data = await repo.insertEntry({
      UserId: parseInt(userId),
      Weight: weight,
      Bmi: bmiValue,
      BodyFat: bodyFatValue,
      MuscleMass: muscleMassValue,
      Bmr: bmrValue,
      WeightImageBase64: imageBase64ToSave,
      CaptureID: captureId || null,
      CreatedAt: createdAtIST,
      UpdatedAt: currentTime,
      City: city || null,
      Village: village || null,
      CenterName: centerName || null,
      NutritionCenterId: nutritionCenterId || null,
      AttendanceType: attendanceType || null,
      Latitude: latitude || null,
      Longitude: longitude || null,
    });
  }

  await touchUserActivity(userId);
  await invalidateUserProfileCache(userId);

  // PR 6 — promote the capture pending → weight. Best-effort: the weight row
  // is already persisted, the state machine is idempotent, and a transient
  // failure here must not surface to the user. Only attempted on initial
  // insert (entryId edits are not tied to a fresh capture).
  if (captureId && !entryId) {
    try {
      await captures.updateTypeById({
        captureId,
        userId: userId.toString(),
        toType: IMAGE_TYPE_WEIGHT,
      });
    } catch (err) {
      logger.warn('weight.saveWeight: failed to promote capture to weight', {
        captureId, userId: userId.toString(), err: err.message,
      });
    }
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      id: data?.ID || data?.id,
      updated: wasUpdated,
      message: wasUpdated ? 'Weight entry updated successfully' : 'Weight entry saved successfully',
      correctionInfo,
      data: {
        userId,
        weightValue: weight,
        unit,
        bmr: bmrValue,
        bmrPreserved: !bmr && bmrValue ? true : false,
        imageBase64: imageBase64ToSave,
        timestamp: new Date().toISOString(),
      },
    },
  };
}

function getISTDateStr(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts).substring(0, 10);
  const istTime = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return istTime.toISOString().substring(0, 10);
}

export async function getHistory({ userId, includeImage, limit = null, offset = 0 }) {
  const useLimit = Number.isFinite(limit) && limit > 0;

  // Step 1: lightweight rows (no image when not requested)
  const rows = await repo.listHistory(userId, false, { limit, offset });

  // Step 2: latest 10 image map (only when client wants images)
  let imageMap = {};
  if (includeImage) {
    const imageRows = await repo.listLatestImages(userId, 10);
    imageRows.forEach((r) => {
      if (r.WeightImageBase64) imageMap[r.ID] = r.WeightImageBase64;
    });
  }

  // Step 3: merge image into rows
  const merged = rows.map((row) => ({
    ...row,
    WeightImageBase64: imageMap[row.ID] || null,
  }));

  // Step 4: format CreatedAt
  const formattedRows = merged.map(formatRow);

  // Step 5: stats — paginating uses a separate lightweight query for accurate global stats
  let globalMin = null, globalMax = null, globalAvg = null;
  let totalCount = formattedRows.length;
  let latestRow = formattedRows[0] || null;
  let previousRow = formattedRows[1] || null;

  if (useLimit) {
    const allRows = await repo.listAllWeightsForStats(userId);
    const allWeights = allRows.map((r) => parseFloat(r.Weight)).filter((w) => !isNaN(w));
    globalMin = allWeights.length ? Math.min(...allWeights) : null;
    globalMax = allWeights.length ? Math.max(...allWeights) : null;
    globalAvg = allWeights.length ? allWeights.reduce((a, b) => a + b, 0) / allWeights.length : null;
    totalCount = allRows.length;
    latestRow = allRows[0] || null;
    previousRow = allRows[1] || null;
  } else {
    const weights = formattedRows.map((r) => parseFloat(r.Weight)).filter((w) => !isNaN(w));
    globalMin = weights.length ? Math.min(...weights) : null;
    globalMax = weights.length ? Math.max(...weights) : null;
    globalAvg = weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : null;
  }

  const stats = {
    totalEntries: totalCount,
    latestWeight: null,
    previousWeight: null,
    weightChange: null,
    averageWeight: globalAvg,
    minWeight: globalMin,
    maxWeight: globalMax,
  };

  if (latestRow) {
    stats.latestWeight = { value: parseFloat(latestRow.Weight), date: latestRow.CreatedAt };
    if (formattedRows[0]) {
      const latestDateStr = getISTDateStr(formattedRows[0].CreatedAt);
      const prevEntry = formattedRows.find(
        (r, idx) => idx > 0 && getISTDateStr(r.CreatedAt) !== latestDateStr,
      );
      if (prevEntry) {
        stats.previousWeight = { value: parseFloat(prevEntry.Weight), date: prevEntry.CreatedAt };
        stats.weightChange = parseFloat(formattedRows[0].Weight) - parseFloat(prevEntry.Weight);
      }
    }
  }

  const returnedOffset = useLimit && Number.isFinite(offset) && offset >= 0 ? offset : 0;
  const hasMore = useLimit ? returnedOffset + formattedRows.length < totalCount : false;

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: formattedRows,
      stats,
      pagination: {
        limit: useLimit ? limit : null,
        offset: returnedOffset,
        total: totalCount,
        hasMore,
      },
    },
  };
}

export async function getImage({ userId, id }) {
  const row = await repo.getImageById(userId, id);
  if (!row) {
    return { httpStatus: 404, body: { success: false, message: 'Not found' } };
  }
  return {
    httpStatus: 200,
    body: { success: true, id: row.ID, image: row.WeightImageBase64 || null },
  };
}

export async function deleteWeight({ userId, entryId }) {
  const updated = await repo.softDelete(entryId, userId);
  if (updated.length === 0) {
    return { httpStatus: 404, body: { success: false, message: 'Weight entry not found or unauthorized' } };
  }
  await invalidateUserProfileCache(userId);
  await touchUserActivity(userId);
  return {
    httpStatus: 200,
    body: { success: true, message: 'Weight entry deleted successfully', deletedId: entryId },
  };
}

export async function undoDeleteWeight({ id, userId }) {
  if (userId) {
    const owns = await repo.checkOwnership(id, userId);
    if (!owns) {
      return { httpStatus: 403, body: { success: false, message: 'You do not have permission to restore this item.' } };
    }
  }
  const restored = await repo.restoreEntry(id);
  if (restored.length === 0) {
    return { httpStatus: 404, body: { success: false, message: 'Weight entry not found' } };
  }
  if (userId) {
    await invalidateUserProfileCache(userId);
    await touchUserActivity(userId);
  }
  return {
    httpStatus: 200,
    body: { success: true, message: 'Weight entry restored successfully', restoredId: id },
  };
}
