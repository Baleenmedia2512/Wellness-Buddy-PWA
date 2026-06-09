/**
 * backend/features/water/domain/reminder.rules.js
 * ---------------------------------------------------------------------------
 * PURE business rules for water hydration reminders.
 *
 * Per claude.md §3.1 / §2.2: no I/O, no axios, no pg, no process.env.
 *
 * Formula:
 *   requiredMl    = weightKg × WATER_ML_PER_KG (50 ml/kg)
 *   reminderCount = round(requiredMl / 1000)       — 1 reminder per litre
 *   intervalMin   = floor(windowDuration / reminderCount)
 *
 * Examples (9-hour activity window):
 *   60 kg → 3,000 ml → 3 reminders → 180 min (3 h) apart
 *   80 kg → 4,000 ml → 4 reminders → 135 min (≈ 2 h) apart
 *   98 kg → 4,900 ml → 5 reminders → 108 min (≈ 1.5 h) apart
 * ---------------------------------------------------------------------------
 */

/** ml of water per kg of body weight. Mirrors intake.rules.js ML_PER_KG. */
export const WATER_ML_PER_KG = 50;

/** Default daily water requirement (ml) when weight is unknown. */
export const DEFAULT_WATER_ML = 2500;

/**
 * How many minutes wide each "send slot" is.
 * Matches the 2-minute precision used by personalised task reminders
 * so each slot fires exactly once per cron cycle.
 */
export const REMINDER_SLOT_WINDOW_MINUTES = 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a time string (HH:MM or HH:MM:SS) to minutes from midnight.
 * Returns 0 for any invalid input so callers never receive NaN.
 *
 * @param {string} timeStr
 * @returns {number}
 */
export function timeStrToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

// ─── Core domain functions ────────────────────────────────────────────────────

/**
 * Derive how much water a user needs and how many reminders to send.
 *
 * @param {number|string|null|undefined} weightKgRaw
 * @returns {{
 *   requiredMl:    number,
 *   reminderCount: number,
 *   weightKg:      number|null,
 *   isDefault:     boolean,
 * }}
 */
export function calculateWaterTarget(weightKgRaw) {
  const kg = parseFloat(weightKgRaw);
  if (!Number.isFinite(kg) || kg <= 0) {
    return {
      requiredMl:    DEFAULT_WATER_ML,
      reminderCount: Math.round(DEFAULT_WATER_ML / 1000), // 3
      weightKg:      null,
      isDefault:     true,
    };
  }
  const requiredMl    = Math.round(kg * WATER_ML_PER_KG);
  const reminderCount = Math.round(requiredMl / 1000);
  return { requiredMl, reminderCount, weightKg: kg, isDefault: false };
}

/**
 * Calculate the full reminder schedule given weight and the activity time window.
 *
 * Reminders are spaced at equal intervals starting from window open:
 *   slot[0] = windowStart
 *   slot[i] = windowStart + i × intervalMin
 *
 * @param {number|string|null} weightKgRaw
 * @param {string} windowStartStr  e.g. '08:00:00' or '08:00'
 * @param {string} windowEndStr    e.g. '17:00:00' or '17:00'
 * @returns {{
 *   requiredMl:       number,
 *   reminderCount:    number,
 *   intervalMin:      number,
 *   scheduledMinutes: number[],
 *   windowStartMin:   number,
 *   windowEndMin:     number,
 * }}
 */
export function calculateWaterReminderSchedule(weightKgRaw, windowStartStr, windowEndStr) {
  const { requiredMl, reminderCount } = calculateWaterTarget(weightKgRaw);

  const windowStartMin = timeStrToMinutes(windowStartStr || '07:00');
  const windowEndMin   = timeStrToMinutes(windowEndStr   || '22:00');

  // Guard against zero/negative window (misconfigured data)
  const windowDuration = Math.max(windowEndMin - windowStartMin, 60);
  const intervalMin    = Math.floor(windowDuration / reminderCount);

  const scheduledMinutes = Array.from(
    { length: reminderCount },
    (_, i) => windowStartMin + i * intervalMin,
  );

  return {
    requiredMl,
    reminderCount,
    intervalMin,
    scheduledMinutes,
    windowStartMin,
    windowEndMin,
  };
}

/**
 * True if the current minute falls inside the next-due send slot.
 * The slot is REMINDER_SLOT_WINDOW_MINUTES wide to match the 1-minute
 * cron resolution and prevent repeated firings.
 *
 * @param {number[]} scheduledMinutes  Reminder times in minutes from midnight.
 * @param {number}   sentCount         How many reminders have already been sent today.
 * @param {number}   currentMinutes    Current time in minutes from midnight.
 * @returns {boolean}
 */
export function isWaterReminderSlotNow(scheduledMinutes, sentCount, currentMinutes) {
  if (sentCount >= scheduledMinutes.length) return false;
  const slotMin = scheduledMinutes[sentCount];
  return currentMinutes >= slotMin && currentMinutes < slotMin + REMINDER_SLOT_WINDOW_MINUTES;
}

/**
 * Master predicate — should we send a water reminder right now?
 *
 * Guards (all must pass):
 *   1. Daily goal not yet met.
 *   2. Not all reminders already sent.
 *   3. Current time is inside the next scheduled send slot.
 *
 * @param {{
 *   schedule:       ReturnType<calculateWaterReminderSchedule>,
 *   sentCount:      number,
 *   totalMl:        number,
 *   currentMinutes: number,
 * }} args
 * @returns {boolean}
 */
export function shouldSendWaterReminder({ schedule, sentCount, totalMl, currentMinutes }) {
  if (totalMl >= schedule.requiredMl) return false;      // goal already met
  if (sentCount >= schedule.reminderCount) return false;  // all reminders used
  return isWaterReminderSlotNow(schedule.scheduledMinutes, sentCount, currentMinutes);
}

/**
 * Build the FCM notification body text for a water reminder.
 *
 * @param {number} totalMl        How much water logged today (ml).
 * @param {number} requiredMl     Daily target (ml).
 * @param {number} reminderNumber 1-based index of this reminder.
 * @param {number} totalReminders Total number of reminders for today.
 * @returns {string}
 */
export function buildWaterReminderBody(totalMl, requiredMl, reminderNumber, totalReminders) {
  const remaining  = Math.max(0, requiredMl - totalMl);
  const remainingL = (remaining / 1000).toFixed(1);
  const goalL      = (requiredMl / 1000).toFixed(1);
  return `${remainingL}L left to reach your ${goalL}L goal. Reminder ${reminderNumber} of ${totalReminders}.`;
}
