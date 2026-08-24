import * as repo from './misc.repository.js';
import { getTimeWindows } from '../../utils/disciplineCalculationsSupabase.js';
import { todayInTimezone } from '../../shared/lib/datetime/index.js';
import { getUserTimezoneIana } from '../user/domain/userTimezone.js';
import { assertCalendarDateYmd } from '../../shared/lib/datetime/calendarDate.js';
import logger from '../../shared/lib/logger.js';

// Hardcoded enum to avoid importing the browser-only ai-token-monitor SDK
const ANALYSIS_MODULES = {
  FOOD_IMAGE_ANALYSIS: 'Food Image Analysis',
  FACE_DETECTION: 'Face Detection',
  PROFILE_IMAGE_UPDATE: 'Profile Image Update',
  PROFILE_IMAGE_SET: 'Profile Image Set'
};

// ─── server-time ────────────────────────────────────────────────────────────
export async function getServerTime() {
  const now = Date.now();
  const timezone = 'Asia/Kolkata';
  return {
    httpStatus: 200,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    body: { date: todayInTimezone(timezone), ts: now, timezone },
  };
}

// ─── time-windows ───────────────────────────────────────────────────────────
export async function fetchTimeWindows() {
  try {
    const windows = await getTimeWindows();
    return {
      httpStatus: 200,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache' },
      body: { success: true, windows },
    };
  } catch (error) {
    console.error('❌ [time-windows] Error:', error);
    return {
      httpStatus: 500,
      body: { success: false, message: 'Failed to fetch time windows', error: error.message },
    };
  }
}

// ─── detect-face ────────────────────────────────────────────────────────────
// ─── detect-face ────────────────────────────────────────────────────────────
/**
 * Parse Gemini face-detect output.
 * The shared `classify` config forces JSON (`responseMimeType: application/json`),
 * so plain `text.startsWith('yes')` was a false-negative for responses like
 * `{"hasFace":true}` or `"yes"`.
 */
function parseHasFace(rawText) {
  const text = String(rawText ?? '').trim();
  if (!text) return false;

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'boolean') return parsed;
    if (typeof parsed === 'string') {
      const s = parsed.trim().toLowerCase();
      return s === 'yes' || s === 'true' || s.startsWith('yes');
    }
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.hasFace === 'boolean') return parsed.hasFace;
      if (typeof parsed.has_face === 'boolean') return parsed.has_face;
      if (typeof parsed.face === 'boolean') return parsed.face;
      const answer = parsed.answer ?? parsed.result ?? parsed.value ?? parsed.response;
      if (typeof answer === 'boolean') return answer;
      if (typeof answer === 'string') {
        const s = answer.trim().toLowerCase();
        return s === 'yes' || s === 'true' || s.startsWith('yes');
      }
    }
  } catch {
    // fall through to plain-text heuristics
  }

  const lower = text.toLowerCase();
  if (/"hasface"\s*:\s*true/.test(lower) || /"has_face"\s*:\s*true/.test(lower)) {
    return true;
  }
  if (/"hasface"\s*:\s*false/.test(lower) || /"has_face"\s*:\s*false/.test(lower)) {
    return false;
  }
  // Strip quotes/punctuation so `"yes"` / `Yes.` still match.
  const normalized = lower.replace(/^["'\s]+|["'\s.!?]+$/g, '');
  if (normalized.startsWith('yes')) return true;
  if (normalized.startsWith('no')) return false;
  return /\byes\b/.test(lower) && !/\bno\b/.test(lower);
}

export async function detectFace({ mimeType, base64Data, userId = null, module = null }) {

  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ [detect-face] GEMINI_API_KEY not configured");

    return {
      httpStatus: 500,
      body: {
        success: false,
        message: "Face detection service not available",
      },
    };
  }

  try {
    const { generateContent, reportAiCallTelemetry } = await import('../../shared/lib/gemini/geminiClient.js');
    const { TraceContext } = await import('../../shared/lib/ai-orchestration/ObservabilityTracer.js');
    const profileModule = module === ANALYSIS_MODULES.PROFILE_IMAGE_UPDATE
      ? ANALYSIS_MODULES.PROFILE_IMAGE_UPDATE
      : ANALYSIS_MODULES.PROFILE_IMAGE_SET;
    const trace = new TraceContext({ userId, module: profileModule });

    let result;
    let latencyMs;
    const parts = [
      {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: base64Data,
        },
      },
      // Must match faceDetect responseMimeType: application/json
      'Does this image contain a clear, visible human face? '
        + 'Respond with JSON only: {"hasFace": true} or {"hasFace": false}. '
        + 'Use true for any clearly visible human face (including photos of people).',
    ];

    try {
      const generated = await generateContent(
        'faceDetect',
        parts,
        null,
        null,
        trace,
      );
      result = generated.result;
      latencyMs = generated.latencyMs;
      await reportAiCallTelemetry({
        status: 'SUCCESS',
        usage: {
          ...(result.response?.usageMetadata ?? {}),
          candidateMetadata: result.response?.candidates?.[0] ?? null
        },
        latency: latencyMs,
        trace,
        parts,
      }).catch(() => {});
    } catch (genErr) {
      await reportAiCallTelemetry({
        status: 'FAILED',
        usage: {},
        latency: genErr.latencyMs ?? 0,
        errorMessage: genErr.message,
        trace,
        parts,
      }).catch(() => {});
      throw genErr;
    }

    const text = result.response.text();
    const hasFace = parseHasFace(text);

    logger.info('[detect-face] result', {
      hasFace,
      traceId: trace.traceId,
      userId: trace.userId,
      rawPreview: String(text ?? '').slice(0, 120),
    });

    trace.complete({ success: true, imageType: 'profile' });

    return {
      httpStatus: 200,
      body: {
        success: true,
        hasFace,
      },
    };

  } catch (err) {

    console.error(
      "❌ [detect-face] Error calling Gemini:",
      err.message
    );

    return {
      httpStatus: 500,
      body: {
        success: false,
        message:
          err.message ||
          "Face detection failed. Please try again.",
      },
    };

  }

}
// ─── club-attendance ────────────────────────────────────────────────────────
export async function getClubAttendance({ userId, startDate, endDate }) {
  const timezoneIana = await getUserTimezoneIana(userId);
  const todayYmd = todayInTimezone(timezoneIana);
  const startYmd = startDate ? String(startDate) : todayYmd;
  const endYmd = endDate ? String(endDate) : todayYmd;
  if (startDate) assertCalendarDateYmd(startYmd, 'startDate');
  if (endDate) assertCalendarDateYmd(endYmd, 'endDate');

  const educationLogs = await repo.fetchEducationLogs(userId, startYmd, endYmd, timezoneIana);

  if (educationLogs.length === 0) {
    return {
      httpStatus: 200,
      body: {
        success: true,
        data: { attendanceRecords: [], clubSummary: [], dateRange: { start: startYmd, end: endYmd }, totalAttendance: 0 },
      },
    };
  }

  const clubIds = [...new Set(educationLogs.map((l) => l.nutrition_center_id).filter(Boolean))];
  const clubs = await repo.fetchClubsByIds(clubIds);
  const ownerIds = [...new Set(clubs.map((c) => c.owner_user_id).filter(Boolean))];
  const owners = await repo.fetchOwnersByIds(ownerIds);

  const ownersMap = {};
  owners.forEach((o) => { ownersMap[o.UserId] = o.UserName; });
  const clubsMap = {};
  clubs.forEach((c) => { clubsMap[c.id] = { ...c, ownerName: ownersMap[c.owner_user_id] || 'Unknown Owner' }; });

  const attendanceRecords = educationLogs.map((log) => {
    const club = clubsMap[log.nutrition_center_id];
    return {
      id: log.Id,
      date: log.CreatedAt.split('T')[0],
      time: new Date(log.CreatedAt).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true,
      }),
      clubId: log.nutrition_center_id,
      clubName: log.center_name || club?.center_name || 'Unknown Club',
      clubOwnerName: club?.ownerName || 'Unknown Owner',
    };
  });

  const clubSummaryMap = {};
  attendanceRecords.forEach((record) => {
    const key = record.clubId || record.clubName;
    if (!clubSummaryMap[key]) {
      clubSummaryMap[key] = {
        clubId: record.clubId,
        clubName: record.clubName,
        clubOwnerName: record.clubOwnerName,
        attendanceCount: 0,
        dates: [],
      };
    }
    clubSummaryMap[key].attendanceCount++;
    if (!clubSummaryMap[key].dates.includes(record.date)) {
      clubSummaryMap[key].dates.push(record.date);
    }
  });

  const clubSummary = Object.values(clubSummaryMap).sort((a, b) => b.attendanceCount - a.attendanceCount);

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        attendanceRecords,
        clubSummary,
        dateRange: { start: startYmd, end: endYmd },
        totalAttendance: attendanceRecords.length,
      },
    },
  };
}
