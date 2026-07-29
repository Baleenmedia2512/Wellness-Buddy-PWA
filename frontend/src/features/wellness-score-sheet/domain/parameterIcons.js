/**
 * Meaningful Lucide icons per wellness score parameter.
 */
import {
  Scale,
  GraduationCap,
  Coffee,
  Utensils,
  Soup,
  Moon,
  Droplets,
  Flame,
  Wheat,
  Droplet,
  Beef,
  Beaker,
  HeartPulse,
  Candy,
  Leaf,
  Activity,
  Pill,
  Sun,
  Citrus,
  Bone,
  Zap,
  Shield,
  Brain,
  Sparkles,
  TrendingDown,
  Dumbbell,
  CircleDot,
} from 'lucide-react';

/** @type {Record<string, React.ComponentType<{ className?: string }>>} */
export const PARAMETER_ICONS = {
  weight_post: Scale,
  edu_post: GraduationCap,
  breakfast_post: Coffee,
  lunch_post: Utensils,
  dinner_post: Moon,
  water_qty: Droplets,

  calories: Flame,
  carbohydrates: Wheat,
  fat: Droplet,
  protein: Beef,
  sodium: Beaker,
  cholesterol: HeartPulse,
  sugar: Candy,
  fiber: Leaf,
  gi: Activity,

  vitamin_a: Sun,
  vitamin_c: Citrus,
  vitamin_d: Sun,
  vitamin_e: Shield,
  vitamin_k: Leaf,
  vitamin_b1: Pill,
  vitamin_b2: Pill,
  vitamin_b3: Pill,
  vitamin_b6: Pill,
  vitamin_b9: Pill,
  vitamin_b12: Pill,

  calcium: Bone,
  iron: Zap,
  magnesium: Sparkles,
  potassium: CircleDot,
  zinc: Shield,
  phosphorus: Bone,

  weight_improvement: TrendingDown,
  physical_activity: Dumbbell,
};

const SECTION_ICONS = {
  logging: Activity,
  nutrition: Soup,
  progress: TrendingDown,
};

export function getParameterIcon(key) {
  return PARAMETER_ICONS[key] || CircleDot;
}

export function getSectionIcon(sectionId) {
  return SECTION_ICONS[sectionId] || CircleDot;
}

export const SCORING_MODE_LABELS = {
  binary: 'Time-based',
  progress: 'Progress',
  proportional: 'Target-based',
  limit: 'Limit-based',
};

export const SCORING_MODE_HINTS = {
  binary: 'Full points when logged within the time window; late or missed = 0',
  progress: 'Full points when weight moves toward your goal; no progress = 0',
  proportional: 'Points scale with progress toward target',
  limit: 'Points scale up to limit; exceeding limit = 0',
};

/** Maps wellness score parameter keys to activity_time_windows_table types. */
export const PARAMETER_TIME_WINDOW_KEYS = {
  weight_post: 'weight',
  edu_post: 'education',
  breakfast_post: 'breakfast',
  lunch_post: 'lunch',
  dinner_post: 'dinner',
};

/** @param {string} timeString - HH:MM or HH:MM:SS — e.g. "3:00 AM", "7:30 AM" */
export function formatClockTime(timeString) {
  if (!timeString) return null;
  const time = String(timeString).slice(0, 5);
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const minute = parseInt(minutes, 10) || 0;
  if (!Number.isFinite(hour)) return null;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${ampm}`;
}

function formatTimeWindowRange(window) {
  if (!window?.start || !window?.end) return null;
  const start = formatClockTime(window.start);
  const end = formatClockTime(window.end);
  if (!start || !end) return null;
  return `between ${start} to ${end}`;
}

function getBinaryScoringHint(parameterKey, timeWindows) {
  const windowKey = PARAMETER_TIME_WINDOW_KEYS[parameterKey];
  // Time-based logging params must show the real window (e.g. 7:15 AM–8:45 AM).
  // Never flash the generic fallback while windows are still loading.
  if (windowKey) {
    const range = formatTimeWindowRange(timeWindows?.[windowKey]);
    if (!range) return '';
    return `Full points when logged ${range} to earn full points; late or missed = 0.`;
  }
  return SCORING_MODE_HINTS.binary;
}

const LIMIT_HINT_LOSS = 'Start from full point; exceeding limit = 0';
const LIMIT_HINT_GAIN = SCORING_MODE_HINTS.limit;
const GI_HINT_LOSS = 'Low and medium GI = full points; high GI = 0';
const GI_HINT_GAIN = 'Full points when average GI ≤ 55; above limit = 0';

/**
 * Scoring hint for a parameter — goal-mode aware for limit/GI nutrition params.
 * @param {string} scoringMode
 * @param {string} [parameterKey]
 * @param {string} [goalMode] - 'loss' | 'gain'
 * @param {{ adminView?: boolean, timeWindows?: Record<string, { start?: string, end?: string }> }} [options]
 */
export function getScoringModeHint(scoringMode, parameterKey, goalMode, { adminView = false, timeWindows = null } = {}) {
  const isGain = String(goalMode || 'loss').toLowerCase() === 'gain';

  if (scoringMode === 'binary') {
    return getBinaryScoringHint(parameterKey, timeWindows);
  }

  if (parameterKey === 'gi') {
    if (adminView) {
      return `Loss: ${GI_HINT_LOSS}. Gain: ${GI_HINT_GAIN}.`;
    }
    return isGain ? GI_HINT_GAIN : GI_HINT_LOSS;
  }

  if (scoringMode === 'limit') {
    if (adminView) {
      return `Loss: ${LIMIT_HINT_LOSS}. Gain: ${LIMIT_HINT_GAIN}.`;
    }
    return isGain ? LIMIT_HINT_GAIN : LIMIT_HINT_LOSS;
  }

  return SCORING_MODE_HINTS[scoringMode] || '';
}
