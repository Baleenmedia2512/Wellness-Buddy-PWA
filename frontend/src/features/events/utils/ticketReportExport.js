/**
 * Host ticket report files. CSV opens in Excel. XLSX is a real workbook.
 */

export const TICKET_REPORT_COLUMNS = [
  'Ticket number',
  'Guest',
  'QR code',
  'Entry',
  'Food',
  'Attendance',
  'QR status',
];

function cell(value) {
  return String(value ?? '');
}

export function ticketReportMatrix(report) {
  const rows = Array.isArray(report?.rows) ? report.rows : [];
  return [
    TICKET_REPORT_COLUMNS,
    ...rows.map((row) => [
      cell(row.ticketNumber),
      cell(row.guestName),
      cell(row.qrCode),
      cell(row.entryStatus),
      cell(row.foodStatus),
      cell(row.attendance),
      cell(row.qrStatus),
    ]),
  ];
}

function csvEscape(value) {
  const text = cell(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function ticketReportCsv(report) {
  const matrix = ticketReportMatrix(report);
  const body = matrix.map((line) => line.map(csvEscape).join(',')).join('\r\n');
  return `\uFEFF${body}`;
}

export function ticketReportFileBase(eventName) {
  const slug = String(eventName || 'event')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'event';
  return `${slug}-ticket-report`;
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

async function saveTextFile(text, fileName, mime) {
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const data = btoa(unescape(encodeURIComponent(text)));
    let result;
    try {
      result = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Documents });
    } catch {
      result = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache });
    }
    const canShare = await Share.canShare().catch(() => ({ value: false }));
    if (canShare.value) {
      await Share.share({
        title: fileName,
        files: [result.uri],
        dialogTitle: 'Save ticket report',
      });
    }
    return { mode: 'saved' };
  }
  const blob = new Blob([text], { type: mime });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
  return { mode: 'download' };
}

export function downloadTicketReportCsv(report) {
  const name = `${ticketReportFileBase(report?.eventName)}.csv`;
  return saveTextFile(ticketReportCsv(report), name, 'text/csv;charset=utf-8');
}

export async function downloadTicketReportExcel(report) {
  let ExcelJS;
  try {
    ExcelJS = (await import('exceljs/dist/exceljs.min.js')).default;
  } catch {
    ExcelJS = (await import('exceljs')).default;
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Tickets');
  const matrix = ticketReportMatrix(report);
  matrix.forEach((line) => sheet.addRow(line));
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 22;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `${ticketReportFileBase(report?.eventName)}.xlsx`;
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const data = arrayBufferToBase64(buffer);
    let result;
    try {
      result = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Documents });
    } catch {
      result = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache });
    }
    const canShare = await Share.canShare().catch(() => ({ value: false }));
    if (canShare.value) {
      await Share.share({
        title: fileName,
        files: [result.uri],
        dialogTitle: 'Save ticket report',
      });
    }
    return { mode: 'saved' };
  }
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
  return { mode: 'download' };
}
