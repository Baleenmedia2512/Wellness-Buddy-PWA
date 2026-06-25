import * as repo from './education.repository.js';
import { cache, cacheKeys } from '../../utils/cache.js';
import { getTimeWindows } from '../../utils/disciplineCalculationsSupabase.js';
// PR 6 — captures_table is canonical for the at-capture-time write. The
// education save endpoint promotes the linked capture pending → education
// when `captureId` is supplied. Best-effort: a captures-side failure is
// logged and does NOT fail the user's education save.
import * as captures from '../captures/captures.service.js';
import { IMAGE_TYPE_EDUCATION } from '../captures/domain/image-types.js';
import logger from '../../shared/lib/logger.js';
import { confirmPersisted } from '../../shared/lib/ai-orchestration/AIAnalysisOrchestrator.js';

const { getISTTimestamp, convertToIST } = repo;

// ─── save log ────────────────────────────────────────────────────────────────
export async function saveLog(input) {
  const {
    userId, imageBase64, platform, topic, confidence, participantCount,
    deviceInfo, latitude, longitude, attendanceType, nutritionCenterId,
    centerName, imageTimestamp, city, village,
    captureId,
  } = input;

  const imageBase64ToSave = (imageBase64 && imageBase64.trim() !== '') ? imageBase64 : null;

  const timeWindows = await getTimeWindows();
  const educationWindow = timeWindows.education || { start: '05:00:00', end: '23:59:00' };

  let logTimestampIST, logTimeOnlyIST, deviceTime;
  if (imageTimestamp) {
    const ist = convertToIST(imageTimestamp);
    logTimestampIST = ist.istTimestamp;
    logTimeOnlyIST = ist.istTimeOnly;
    deviceTime = ist.originalDeviceTime;
  } else {
    logTimestampIST = getISTTimestamp();
    logTimeOnlyIST = logTimestampIST.substring(11, 19);
    deviceTime = null;
  }
  const isOnTime = logTimeOnlyIST >= educationWindow.start && logTimeOnlyIST <= educationWindow.end;

  const data = await repo.insertLog({
    UserId: userId,
    Platform: platform,
    Topic: topic,
    Confidence: confidence || null,
    DeviceInfo: deviceInfo || null,
    ImageBase64: imageBase64ToSave,
    latitude: latitude || null,
    longitude: longitude || null,
    attendance_type: attendanceType || null,
    nutrition_center_id: nutritionCenterId || null,
    participant_count: participantCount || null,
    center_name: centerName || null,
    City: city || null,
    Village: village || null,
    CaptureID: captureId || null,
    IsDeleted: false,
    CreatedAt: logTimestampIST,
    UpdatedAt: logTimestampIST,
  });

  await repo.touchLastActive(userId);
  cache.delete(cacheKeys.educationSummary(userId));

  // PR 6 — promote the capture pending → education. Best-effort: see weight
  // slice for rationale.
  if (captureId) {
    try {
      await captures.updateTypeById({
        captureId,
        userId: userId.toString(),
        toType: IMAGE_TYPE_EDUCATION,
      });
    } catch (err) {
      logger.warn('education.saveLog: failed to promote capture to education', {
        captureId, userId: userId.toString(), err: err.message,
      });
    }
    // Signal to the orchestrator that the education row is now persisted.
    // Transitions analysisStatus from ANALYZING → FAST_COMPLETE.
    confirmPersisted(captureId, { logId: data?.Id || data?.id || data?.ID });
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'Education log saved successfully',
      id: data?.Id || data?.id || data?.ID,
      attendanceType,
      isOnTime,
      timeWindow: educationWindow,
      uploadTime: logTimeOnlyIST,
      logTimestamp: logTimestampIST,
      deviceTime,
      timestampSource: imageTimestamp ? 'EXIF (converted to IST)' : 'server (IST)',
      timezone: 'IST (UTC+5:30)',
    },
  };
}

// ─── list logs ───────────────────────────────────────────────────────────────
export async function listLogs({ userId, limit = null, offset = 0, includeImage = true }) {
  const useLimit = Number.isFinite(limit) && limit > 0;
  const fromIdx = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  const logs = await repo.listLogs(userId, { limit, offset: fromIdx, includeImage });
  const THUMB_CHARS = 5000;
  const trimmedLogs = logs.map((log) => ({
    ...log,
    ImageBase64: includeImage
      ? (log.ImageBase64
          ? (log.ImageBase64.length > THUMB_CHARS ? log.ImageBase64.slice(0, THUMB_CHARS) : log.ImageBase64)
          : null)
      : null,
    // When image data is omitted from SELECT, assume true so the card lazy-fetches
    hasFullImage: includeImage
      ? !!(log.ImageBase64 && log.ImageBase64.length > 0)
      : true,
  }));
  let pagination = null;
  if (useLimit) {
    const total = await repo.countLogs(userId);
    const hasMore = total != null
      ? (fromIdx + trimmedLogs.length) < total
      : trimmedLogs.length === limit;
    pagination = { limit, offset: fromIdx, total: total ?? trimmedLogs.length, hasMore };
  }
  return {
    httpStatus: 200,
    body: { success: true, count: trimmedLogs.length, logs: trimmedLogs, pagination },
  };
}

// ─── get log image ───────────────────────────────────────────────────────────
export async function getLogImage({ logId, userId }) {
  const data = await repo.getLogImage(logId, userId);
  if (!data) return { httpStatus: 404, body: { success: false, message: 'Log not found' } };
  return {
    httpStatus: 200,
    body: { success: true, imageBase64: data.ImageBase64 || null },
  };
}

// ─── summary ─────────────────────────────────────────────────────────────────
export async function getSummary({ userId }) {
  const cacheKey = cacheKeys.educationSummary(userId);
  const cached = cache.get(cacheKey);
  if (cached) {
    return { httpStatus: 200, body: cached, headers: { 'X-Cache': 'HIT' } };
  }

  const logs = await repo.summaryLogs(userId);
  const totalSessions = logs.length;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthCount = logs.filter((log) => {
    const d = new Date(log.CreatedAt);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  const platformCounts = {};
  logs.forEach((log) => {
    platformCounts[log.Platform] = (platformCounts[log.Platform] || 0) + 1;
  });
  const platformsResult = Object.entries(platformCounts)
    .map(([platform, count]) => ({ Platform: platform, count }))
    .sort((a, b) => b.count - a.count);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const last7DaysLogs = logs.filter((log) => new Date(log.CreatedAt) >= sevenDaysAgo);
  const last7DaysCount = last7DaysLogs.length;
  const last7DaysDateSet = new Set();
  last7DaysLogs.forEach((log) => {
    const d = new Date(log.CreatedAt);
    d.setHours(0, 0, 0, 0);
    last7DaysDateSet.add(d.toISOString().split('T')[0]);
  });
  const last7DaysDates = Array.from(last7DaysDateSet).sort();

  let currentStreak = 0;
  if (logs.length > 0) {
    const dates = logs.map((row) => new Date(row.CreatedAt).toDateString());
    const uniqueDates = [...new Set(dates)].sort((a, b) => new Date(b) - new Date(a));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toDateString();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    if (uniqueDates.includes(todayStr) || uniqueDates.includes(yesterdayStr)) {
      const checkDate = new Date(today);
      if (!uniqueDates.includes(todayStr)) checkDate.setDate(checkDate.getDate() - 1);
      while (uniqueDates.includes(checkDate.toDateString())) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }
  }

  const response = {
    success: true,
    summary: {
      totalSessions,
      monthCount,
      topPlatform: platformsResult.length > 0 ? platformsResult[0].Platform : null,
      platformsInUse: platformsResult.length,
      last7DaysCount,
      last7DaysDates,
      currentStreak,
    },
  };
  cache.set(cacheKey, response, 180000);
  return { httpStatus: 200, body: response, headers: { 'X-Cache': 'MISS' } };
}

// ─── delete ──────────────────────────────────────────────────────────────────
export async function deleteLog({ userId, logId }) {
  const data = await repo.softDeleteLog(logId, userId);
  if (data.length === 0) {
    return {
      httpStatus: 404,
      body: { success: false, message: 'Education log not found or already deleted' },
    };
  }
  cache.delete(cacheKeys.educationSummary(userId));
  await repo.touchLastActive(userId);
  return {
    httpStatus: 200,
    body: { success: true, message: 'Education log deleted successfully', deletedId: logId },
  };
}

// ─── undo delete ─────────────────────────────────────────────────────────────
export async function undoDelete({ id, userId }) {
  if (userId) {
    const owns = await repo.checkOwnership(id, userId);
    if (!owns) {
      return {
        httpStatus: 403,
        body: { success: false, message: 'You do not have permission to restore this item.' },
      };
    }
  }
  const data = await repo.restoreLog(id);
  if (data.length === 0) {
    return { httpStatus: 404, body: { success: false, message: 'Education log not found' } };
  }
  if (userId) {
    cache.delete(cacheKeys.educationSummary(userId));
    await repo.touchLastActive(userId);
  }
  return {
    httpStatus: 200,
    body: { success: true, message: 'Education log restored successfully', restoredId: id },
  };
}
