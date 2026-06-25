/**
 * Screen feature — service layer.
 */
import { getISTTimestamp } from '../../utils/supabaseClient.js';
import * as repo from './screen.repository.js';

function shiftDateStr(dateStr, deltaDays) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaDays);
  const yr = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const dy = String(date.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}

export async function saveScreenTime({ userId, date, totalScreenTimeSeconds }) {
  const now = getISTTimestamp();
  const existing = await repo.findByUserAndDate(userId, date);

  let savedRow;
  if (existing.length > 0) {
    const keepId = existing[0].Id;
    if (existing.length > 1) {
      await repo.deleteByIds(existing.slice(1).map(r => r.Id));
    }
    savedRow = await repo.updateRow(keepId, {
      TotalScreenTimeSeconds: totalScreenTimeSeconds,
      CreatedAt: now,
    });
  } else {
    savedRow = await repo.insertRow({
      UserId: userId,
      Date: date,
      TotalScreenTimeSeconds: totalScreenTimeSeconds,
      CreatedAt: now,
    });
  }

  return {
    httpStatus: 200,
    body: { success: true, message: 'Screen time saved successfully', data: savedRow },
  };
}

export async function getScreenTimeHistory({ userId, days, endDate }) {
  const startDate = shiftDateStr(endDate, -(days - 1));
  const rows = await repo.listRange(userId, startDate, endDate);

  // dedupe: keep highest seconds per date
  const byDate = new Map();
  for (const row of rows) {
    const existing = byDate.get(row.Date);
    if (!existing || (row.TotalScreenTimeSeconds || 0) > (existing.TotalScreenTimeSeconds || 0)) {
      byDate.set(row.Date, row);
    }
  }
  const records = Array.from(byDate.values()).sort((a, b) => b.Date.localeCompare(a.Date));

  const totalSeconds = records.reduce((s, r) => s + (r.TotalScreenTimeSeconds || 0), 0);
  const averageSeconds = records.length > 0 ? Math.round(totalSeconds / records.length) : 0;

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: records,
      summary: {
        totalDays: records.length,
        totalSeconds,
        averageSeconds,
        requestedDays: days,
      },
    },
  };
}
