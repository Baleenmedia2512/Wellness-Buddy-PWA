import { GoogleGenerativeAI } from '@google/generative-ai';
import * as repo from './misc.repository.js';
import { getTimeWindows } from '../../utils/disciplineCalculationsSupabase.js';
import { todayInTimezone } from '../../shared/lib/datetime/index.js';
import { getUserTimezoneIana } from '../user/domain/userTimezone.js';
import { assertCalendarDateYmd } from '../../shared/lib/datetime/calendarDate.js';
import logger from '../../shared/lib/logger.js';
import {
  MODEL_NAME,
  generateContent,
} from '../../shared/lib/gemini/geminiClient.js';

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
export async function detectFace({ imageBase64 }) {

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

    const mimeMatch = imageBase64.match(
      /^data:(image\/[a-zA-Z]+);base64,/
    );

    const mimeType = mimeMatch
      ? mimeMatch[1]
      : "image/jpeg";

    const base64Data = imageBase64.replace(
      /^data:image\/[a-zA-Z]+;base64,/,
      ""
    );

    const result = await generateContent(
      "classify",
      [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        "Does this image contain a clear, visible human face? Answer with only 'yes' or 'no'.",
      ]
    );

    const text = result.response
      .text()
      .trim()
      .toLowerCase();

    const hasFace = text.startsWith("yes");

    logger.debug(
      `✅ [detect-face] Detection result: ${
        hasFace ? "face found" : "no face"
      } (raw: "${text}")`
    );

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
