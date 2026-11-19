import { getEducationLogsForDate } from './features/wellness-score/data/wellness-score.repo.js';
import { getTimeWindows } from './utils/disciplineCalculationsQuery.js';
import { calculateEducationPost } from './features/wellness-score/domain/score.rules.js';
import { resolveCreatedAtTimeOfDay } from './features/wellness-score/domain/window.helpers.js';

const logs = await getEducationLogsForDate(279, '2026-10-28');
const windows = await getTimeWindows();
const window = windows.education;
console.log('window', typeof window?.start, JSON.stringify(window?.start), JSON.stringify(window?.end));
for (const row of logs) {
  const raw = row.CreatedAt;
  console.log(
    'log',
    raw instanceof Date ? 'Date' : typeof raw,
    raw instanceof Date ? raw.toISOString() : String(raw),
    row.Platform,
    String(row.Topic || '').slice(0, 40),
    'clock',
    resolveCreatedAtTimeOfDay(raw, 'Asia/Kolkata', 'activity'),
  );
}
const scored = calculateEducationPost({
  maxPoints: 100,
  educationLogs: logs,
  window,
});
console.log('score', scored.earnedPoints, scored.calculationReason);
process.exit(0);
