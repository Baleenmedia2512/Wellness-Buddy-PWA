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
      CreatedAt: createdAtIST,
      UpdatedAt: currentTime,
    });
  }

  await touchUserActivity(userId);
  await invalidateUserProfileCache(userId);

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

export async function getHistory({ userId, includeImage }) {
  const rows = await repo.listHistory(userId, includeImage);
  const formatted = rows.map(formatRow);
  return {
    httpStatus: 200,
    body: { success: true, data: formatted, stats: buildStats(formatted) },
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
