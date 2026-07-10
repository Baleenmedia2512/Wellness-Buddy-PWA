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
