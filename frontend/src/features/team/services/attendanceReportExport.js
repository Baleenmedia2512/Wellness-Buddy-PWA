/**
 * attendanceReportExport.js — CSV generation + cross-platform save/share.
 *
 * Owns the Capacitor Filesystem + Share path on native and the
 * Web Share / anchor-download fallback in the browser. CSV row layout
 * preserved verbatim from the legacy `AttendanceReport.js`.
 */
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const CSV_HEADERS = [
  'S.No', 'Name', 'City', 'Village', 'Phone', 'Coach', 'Date', 'Time', 'Club Name',
];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const csvCell = (value) => `"${(value || '').replace(/"/g, '""')}"`;

export function buildAttendanceCsv(attendanceData) {
  const rows = [
    CSV_HEADERS.join(','),
    ...attendanceData.map((r) => [
      r.sno, csvCell(r.userName), csvCell(r.city), csvCell(r.village),
      csvCell(r.phone), csvCell(r.coach), r.date || '', r.time || '',
      csvCell(r.clubName),
    ].join(',')),
  ];
  return rows.join('\n');
}

export function buildAttendanceFilename(date, userName) {
  const dateObj = new Date(date);
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const monthName = MONTH_NAMES[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  const username = userName || 'user';
  return `${day}-${month}(${monthName})-${year}-${username}-attendance.csv`;
}

async function shareNative({ content, fileName, title }) {
  const result = await Filesystem.writeFile({
    path: fileName, data: content, directory: Directory.Cache, encoding: Encoding.UTF8,
  });
  await Share.share({
    title: title || 'Attendance Report',
    text: 'Choose where to save or share your attendance report',
    files: [result.uri],
    dialogTitle: 'Save or Share Report',
  });
  return { success: true, path: result.uri, location: 'Shared - user can choose location' };
}

async function shareWebOrDownload({ content, fileName, mimeType, title }) {
  const blob = new Blob([content], { type: mimeType });
  const file = new File([blob], fileName, { type: mimeType });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ title: title || 'Attendance Report', files: [file] });
      return { success: true, location: 'Shared via browser', isWeb: true };
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, cancelled: true };
    }
  }
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  return { success: true, location: 'browser download', isWeb: true };
}

export async function saveOrShareFile(payload) {
  if (Capacitor.isNativePlatform()) {
    try { return await shareNative(payload); }
    catch (error) {
      console.error('Error saving/sharing file:', error);
      throw new Error(`Failed to save or share file: ${error.message}`);
    }
  }
  return shareWebOrDownload(payload);
}

export async function fetchAttendanceCsvData({ apiBaseUrl, userId, date }) {
  const response = await fetch(
    `${apiBaseUrl}/api/coach/download-attendance-excel?userId=${userId}&date=${date}`,
    { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } },
  );
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Failed to fetch attendance data');
  }
  return result.data || [];
}
