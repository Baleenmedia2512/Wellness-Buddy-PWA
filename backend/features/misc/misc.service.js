import { GoogleGenerativeAI } from '@google/generative-ai';
import * as repo from './misc.repository.js';
import { getTimeWindows } from '../../utils/disciplineCalculationsSupabase.js';
import { formatDateForMySQL } from '../../utils/disciplineHelpers.js';

// ─── server-time ────────────────────────────────────────────────────────────
export async function getServerTime() {
  const now = Date.now();
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now + IST_OFFSET_MS).toISOString().split('T')[0];
  return {
    httpStatus: 200,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    body: { date: istDate, ts: now, timezone: 'Asia/Kolkata' },
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
export async function detectFace({ imageBase64 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ [detect-face] GEMINI_API_KEY not configured');
    return { httpStatus: 500, body: { success: false, message: 'Face detection service not available' } };
  }

  try {
    const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      "Does this image contain a clear, visible human face? Answer with only 'yes' or 'no'.",
    ]);

    const text = result.response.text().trim().toLowerCase();
    const hasFace = text.startsWith('yes');
    console.log(`✅ [detect-face] Detection result: ${hasFace ? 'face found' : 'no face'} (raw: "${text}")`);
    return { httpStatus: 200, body: { success: true, hasFace } };
  } catch (err) {
    console.error('❌ [detect-face] Error calling Gemini:', err.message, err.status, err?.errorDetails);
    return {
      httpStatus: 500,
      body: { success: false, message: err.message || 'Face detection failed. Please try again.' },
    };
  }
}

// ─── club-attendance ────────────────────────────────────────────────────────
export async function getClubAttendance({ userId, startDate, endDate }) {
  const start = (startDate || formatDateForMySQL(new Date())) + 'T00:00:00';
  const end = (endDate || formatDateForMySQL(new Date())) + 'T23:59:59';

  const educationLogs = await repo.fetchEducationLogs(userId, start, end);

  if (educationLogs.length === 0) {
    return {
      httpStatus: 200,
      body: {
        success: true,
        data: { attendanceRecords: [], clubSummary: [], dateRange: { start, end }, totalAttendance: 0 },
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
        dateRange: { start, end },
        totalAttendance: attendanceRecords.length,
      },
    },
  };
}
