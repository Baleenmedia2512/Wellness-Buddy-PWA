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
  binary: 'On-time',
  progress: 'Progress',
  proportional: 'Target',
  limit: 'Limit',
};

export const SCORING_MODE_HINTS = {
  binary: 'Full points when done on time; late or missed = 0',
  progress: 'Full points when weight moves toward your goal; no progress = 0',
  proportional: 'Points scale with progress toward target',
  limit: 'Points scale up to limit; exceeding limit = 0',
};

const LIMIT_HINT_LOSS = 'Start from full point; exceeding limit = 0';
const LIMIT_HINT_GAIN = SCORING_MODE_HINTS.limit;
const GI_HINT_LOSS = 'Low and medium GI = full points; high GI = 0';
const GI_HINT_GAIN = 'Full points when average GI ≤ 55; above limit = 0';

/**
 * Scoring hint for a parameter — goal-mode aware for limit/GI nutrition params.
 * @param {string} scoringMode
 * @param {string} [parameterKey]
 * @param {string} [goalMode] - 'loss' | 'gain'
 * @param {{ adminView?: boolean }} [options]
 */
export function getScoringModeHint(scoringMode, parameterKey, goalMode, { adminView = false } = {}) {
  const isGain = String(goalMode || 'loss').toLowerCase() === 'gain';

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
