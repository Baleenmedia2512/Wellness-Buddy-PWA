/**
 * Build + share/download Wellness Score Report Excel (.xlsx).
 * Uses dynamic import of exceljs so the main bundle stays light.
 * Native: write to Cache + Capacitor Share / Filesystem.
 * Web: Blob download.
 */
import { Capacitor } from '@capacitor/core';
import { computeWeightChange, formatWeightKg, formatWellnessScore } from './wellnessScoreReportFormat.js';

const EXCEL_HEADERS = [
  'NAME',
  'TODAY WEIGHT',
  'TODAY VS PREVIOUS WEIGHT',
  'WEIGHT CHANGE',
  'WELLNESS SCORE',
  'SPONSOR',
  'COACH',
];

/**
 * @param {Date} [date]
 * @returns {string} Wellness_Score_Report_YYYY_MM_DD.xlsx
 */
export function buildWellnessScoreReportFileName(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `Wellness_Score_Report_${y}_${m}_${d}.xlsx`;
}

/**
 * @param {Array<object>} rows
 * @returns {Promise<ArrayBuffer>}
 */
export async function buildWellnessScoreWorkbookBuffer(rows) {
  // Prefer the browser UMD build to avoid Node fs/stream polyfills in CRA.
  let ExcelJS;
  try {
    ExcelJS = (await import('exceljs/dist/exceljs.min.js')).default;
  } catch {
    ExcelJS = (await import('exceljs')).default;
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Wellness Valley';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Wellness Score Report', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }],
  });

  sheet.columns = [
    { header: EXCEL_HEADERS[0], key: 'name', width: 22 },
    { header: EXCEL_HEADERS[1], key: 'todayWeight', width: 16 },
    { header: EXCEL_HEADERS[2], key: 'vsPrevious', width: 28 },
    { header: EXCEL_HEADERS[3], key: 'change', width: 16 },
    { header: EXCEL_HEADERS[4], key: 'score', width: 16 },
    { header: EXCEL_HEADERS[5], key: 'sponsor', width: 18 },
    { header: EXCEL_HEADERS[6], key: 'coach', width: 18 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle' };

  for (const row of rows || []) {
    const change = computeWeightChange(
      row.todayWeight,
      row.previousWeight,
      row.difference,
    );
    let changeCell = '—';
    if (change.direction === 'down') changeCell = `⬇ ${change.changeLabel}`;
    else if (change.direction === 'up') changeCell = `⬆ ${change.changeLabel}`;

    sheet.addRow({
      name: row.name || '',
      todayWeight: formatWeightKg(row.todayWeight) || '',
      vsPrevious: change.comparisonLabel,
      change: changeCell,
      score: formatWellnessScore(row.totalEarned ?? row.wellnessScore),
      sponsor: row.sponsor || '',
      coach: row.coach || '',
    });
  }

  // Auto-size columns from content (with a sensible max).
  sheet.columns.forEach((col) => {
    let max = String(col.header || '').length;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len > max) max = len;
    });
    col.width = Math.min(Math.max(max + 2, 12), 40);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Share Excel via native share sheet (WhatsApp, Gmail, Drive, etc.) or web download fallback.
 * @param {ArrayBuffer} buffer
 * @param {string} fileName
 */
export async function shareWellnessScoreExcel(buffer, fileName) {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const base64 = arrayBufferToBase64(buffer);
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });

    const canShare = await Share.canShare().catch(() => ({ value: false }));
    if (canShare.value) {
      await Share.share({
        title: 'Wellness Score Report',
        text: 'Wellness Score Report',
        files: [result.uri],
        dialogTitle: 'Share Wellness Score Report',
      });
      return { mode: 'share', uri: result.uri };
    }
    return { mode: 'saved', uri: result.uri };
  }

  downloadWellnessScoreExcel(buffer, fileName);
  return { mode: 'download' };
}

/**
 * Save Excel to device storage (native Documents) or browser download (web).
 * @param {ArrayBuffer} buffer
 * @param {string} fileName
 */
export async function downloadWellnessScoreExcel(buffer, fileName) {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const base64 = arrayBufferToBase64(buffer);

    let result;
    try {
      result = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents,
      });
    } catch {
      result = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });
    }

    const canShare = await Share.canShare().catch(() => ({ value: false }));
    if (canShare.value) {
      // Offer save/share sheet so the user can store to Drive / Files.
      await Share.share({
        title: 'Wellness Score Report',
        text: 'Save Wellness Score Report',
        files: [result.uri],
        dialogTitle: 'Save Wellness Score Report',
      });
    }
    return { mode: 'saved', uri: result.uri };
  }

  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  return { mode: 'download' };
}
