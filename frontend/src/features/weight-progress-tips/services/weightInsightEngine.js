/**
 * weightInsightEngine.js
 *
 * Rule-based reasoning engine for weight-progress nutrition insights.
 * Pure domain logic — no React, no I/O.
 *
 * Flow:
 *   Weight + nutrition + targets + goal
 *     → evaluate scenario-specific rules
 *     → rank by impactScore
 *     → return structured insight for UI rendering
 */

// ─── Configuration (no magic numbers in rule bodies) ───────────────────────

export const WEIGHT_INSIGHT_CONFIG = {
  weightTolerance: 0.2,
  maxReasons: 4,

  /** Over-target multipliers (loss mode — unfavorable surplus) */
  calorieHigh: 1.05,
  carbHigh: 1.1,
  fatHigh: 1.1,

  /** Under-target multipliers (deficiency / gain-mode shortfall) */
  proteinLow: 0.8,
  waterLow: 0.6,

  /** Maintenance — ignore deviations within this fraction of target */
  maintenanceTolerance: 0.1,

  /** Severity bands — fraction deviation from threshold */
  severityCritical: 0.25,
  severityHigh: 0.15,
  severityMedium: 0.08,

  /** Base impact scores for ranking (higher = more likely shown first) */
  impactScores: {
    calories_over: 95,
    protein_under: 90,
    water_under: 85,
    fat_over: 70,
    carbs_over: 60,
    calories_under: 95,
    protein_under_gain: 90,
    carbs_under: 75,
    fat_under: 70,
    calories_deficit: 90,
    protein_met: 85,
    water_met: 80,
    carbs_met: 70,
    fat_met: 65,
    maintenance_deviation: 50,
  },
};

export const INSIGHT_DISCLAIMER =
  'Weight changes can also occur due to hydration, glycogen storage, hormones, sodium intake, digestion, sleep, exercise recovery, and normal biological variation.';

export const EMPTY_INSIGHT_MESSAGE =
  'No significant nutrition-related contributors were identified for this weight change.';

/** Display metadata — extend here for Fiber, Sodium, etc. without UI changes */
export const PARAMETER_META = {
  calories: { label: 'Calories', icon: '🔥', unit: 'kcal', formatType: 'number' },
  protein: { label: 'Protein', icon: '🥩', unit: 'g', formatType: 'number' },
  carbs: { label: 'Carbs', icon: '🍞', unit: 'g', formatType: 'number' },
  fat: { label: 'Fat', icon: '🥑', unit: 'g', formatType: 'number' },
  water: { label: 'Water', icon: '💧', unit: 'ml', formatType: 'water' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeGoal(goal) {
  if (goal === 'loss' || goal === 'gain' || goal === 'maintain') return goal;
  return 'maintain';
}

function buildNutritionSnapshot(nutrition = {}, targets = {}) {
  return {
    calories: safeNumber(nutrition.calories),
    protein: safeNumber(nutrition.protein),
    carbs: safeNumber(nutrition.carbs),
    fat: safeNumber(nutrition.fat),
    water: safeNumber(nutrition.water),
  };
}

function buildTargetSnapshot(targets = {}) {
  return {
    calories: safeNumber(targets.calories, null),
    protein: safeNumber(targets.protein, null),
    carbs: safeNumber(targets.carbs, null),
    fat: safeNumber(targets.fat, null),
    water: safeNumber(targets.water, null),
  };
}

function hasValidTarget(target) {
  return target != null && Number.isFinite(target) && target > 0;
}

/**
 * Classify weight movement using configurable tolerance.
 * @returns {'first'|'increase'|'decrease'|'stable'}
 */
export function determineWeightTrend(previousWeight, currentWeight, config = WEIGHT_INSIGHT_CONFIG) {
  const previous = safeNumber(previousWeight, null);
  const current = safeNumber(currentWeight, null);

  if (previous == null || current == null) return 'first';
  if (Math.abs(current - previous) <= config.weightTolerance) return 'stable';

  return current > previous ? 'increase' : 'decrease';
}

/** Map deviation ratio → severity tier */
export function severityFromDeviation(deviation, config = WEIGHT_INSIGHT_CONFIG) {
  const d = Math.max(0, safeNumber(deviation));
  if (d >= config.severityCritical) return 'critical';
  if (d >= config.severityHigh) return 'high';
  if (d >= config.severityMedium) return 'medium';
  return 'low';
}

function deviationOver(consumed, target) {
  if (!hasValidTarget(target) || consumed <= target) return 0;
  return (consumed - target) / target;
}

function deviationUnder(consumed, target) {
  if (!hasValidTarget(target) || consumed >= target) return 0;
  return (target - consumed) / target;
}

function buildReason(parameter, fields) {
  const meta = PARAMETER_META[parameter] || {};
  return {
    parameter,
    label: meta.label || parameter,
    icon: meta.icon || '',
    unit: meta.unit || '',
    formatType: meta.formatType || 'number',
    consumed: fields.consumed,
    target: fields.target,
    severity: fields.severity,
    impactScore: fields.impactScore,
    explanation: fields.explanation,
    displayVariant: fields.displayVariant,
  };
}

// ─── Rule primitives ─────────────────────────────────────────────────────────

/**
 * @typedef {object} RuleContext
 * @property {'loss'|'gain'|'maintain'} goal
 * @property {'first'|'increase'|'decrease'|'stable'} weightTrend
 * @property {number|null} previousWeight
 * @property {number|null} currentWeight
 * @property {number} weightDifference
 * @property {{ calories:number, protein:number, carbs:number, fat:number, water:number }} nutrition
 * @property {{ calories:number|null, protein:number|null, carbs:number|null, fat:number|null, water:number|null }} targets
 * @property {typeof WEIGHT_INSIGHT_CONFIG} config
 */

/**
 * @typedef {object} InsightRule
 * @property {string} id
 * @property {string} parameter
 * @property {(ctx: RuleContext) => object|null} evaluate
 */

function overTargetRule({
  id,
  parameter,
  highMultiplierKey,
  impactScoreKey,
  explanation,
}) {
  return {
    id,
    parameter,
    evaluate(ctx) {
      const consumed = ctx.nutrition[parameter];
      const target = ctx.targets[parameter];
      if (!hasValidTarget(target)) return null;

      const threshold = target * ctx.config[highMultiplierKey];
      if (consumed <= threshold) return null;

      const severity = severityFromDeviation(deviationOver(consumed, target), ctx.config);
      return buildReason(parameter, {
        consumed,
        target,
        severity,
        impactScore: ctx.config.impactScores[impactScoreKey],
        explanation,
        displayVariant: 'surplus',
      });
    },
  };
}

function underTargetRule({
  id,
  parameter,
  lowMultiplierKey,
  impactScoreKey,
  explanation,
  /** When true, only matches if consumed < target * lowMultiplier (significant deficit) */
  significantOnly = true,
}) {
  return {
    id,
    parameter,
    evaluate(ctx) {
      const consumed = ctx.nutrition[parameter];
      const target = ctx.targets[parameter];
      if (!hasValidTarget(target)) return null;

      const cutoff = significantOnly ? target * ctx.config[lowMultiplierKey] : target;
      if (consumed >= cutoff) return null;

      const severity = severityFromDeviation(deviationUnder(consumed, target), ctx.config);
      return buildReason(parameter, {
        consumed,
        target,
        severity,
        impactScore: ctx.config.impactScores[impactScoreKey],
        explanation,
        displayVariant: 'deficit',
      });
    },
  };
}

function atOrBelowTargetRule({
  id,
  parameter,
  impactScoreKey,
  explanation,
}) {
  return {
    id,
    parameter,
    evaluate(ctx) {
      const consumed = ctx.nutrition[parameter];
      const target = ctx.targets[parameter];
      if (!hasValidTarget(target) || consumed > target) return null;

      const severity = consumed <= target * 0.9 ? 'medium' : 'low';
      return buildReason(parameter, {
        consumed,
        target,
        severity,
        impactScore: ctx.config.impactScores[impactScoreKey],
        explanation,
        displayVariant: 'positive',
      });
    },
  };
}

function atOrAboveTargetRule({
  id,
  parameter,
  lowMultiplierKey,
  impactScoreKey,
  explanation,
}) {
  return {
    id,
    parameter,
    evaluate(ctx) {
      const consumed = ctx.nutrition[parameter];
      const target = ctx.targets[parameter];
      if (!hasValidTarget(target)) return null;

      const minimum = target * ctx.config[lowMultiplierKey];
      if (consumed < minimum) return null;

      const severity = consumed >= target ? 'medium' : 'low';
      return buildReason(parameter, {
        consumed,
        target,
        severity,
        impactScore: ctx.config.impactScores[impactScoreKey],
        explanation,
        displayVariant: 'positive',
      });
    },
  };
}

function maintenanceDeviationRule({ parameter }) {
  return {
    id: `maintenance_${parameter}`,
    parameter,
    evaluate(ctx) {
      const consumed = ctx.nutrition[parameter];
      const target = ctx.targets[parameter];
      if (!hasValidTarget(target)) return null;

      const deviation = Math.abs(consumed - target) / target;
      if (deviation <= ctx.config.maintenanceTolerance) return null;

      const isOver = consumed > target;
      const severity = severityFromDeviation(deviation, ctx.config);
      const pct = Math.round(deviation * 100);

      return buildReason(parameter, {
        consumed,
        target,
        severity,
        impactScore: ctx.config.impactScores.maintenance_deviation,
        explanation: isOver
          ? `${PARAMETER_META[parameter]?.label || parameter} was about ${pct}% above your maintenance target — may have contributed.`
          : `${PARAMETER_META[parameter]?.label || parameter} was about ${pct}% below your maintenance target — may have contributed.`,
        displayVariant: isOver ? 'surplus' : 'deficit',
      });
    },
  };
}

// ─── Rule sets by scenario ───────────────────────────────────────────────────

/** Loss goal + weight increased — unfavorable; surplus macros + deficiencies only */
const LOSS_WEIGHT_INCREASED_RULES = [
  overTargetRule({
    id: 'loss_up_calories_over',
    parameter: 'calories',
    highMultiplierKey: 'calorieHigh',
    impactScoreKey: 'calories_over',
    explanation: 'Calorie intake was above your target — a possible contributor to weight gain.',
  }),
  overTargetRule({
    id: 'loss_up_carbs_over',
    parameter: 'carbs',
    highMultiplierKey: 'carbHigh',
    impactScoreKey: 'carbs_over',
    explanation: 'Carbohydrate intake was above your target — a possible contributor to weight gain.',
  }),
  overTargetRule({
    id: 'loss_up_fat_over',
    parameter: 'fat',
    highMultiplierKey: 'fatHigh',
    impactScoreKey: 'fat_over',
    explanation: 'Fat intake was above your target — a possible contributor to weight gain.',
  }),
  underTargetRule({
    id: 'loss_up_protein_under',
    parameter: 'protein',
    lowMultiplierKey: 'proteinLow',
    impactScoreKey: 'protein_under',
    explanation: 'Protein intake was significantly below your target — a likely factor in this weight change.',
  }),
  underTargetRule({
    id: 'loss_up_water_under',
    parameter: 'water',
    lowMultiplierKey: 'waterLow',
    impactScoreKey: 'water_under',
    explanation: 'Water intake was significantly below your target — a possible contributor.',
  }),
];

/** Loss goal + weight decreased — favorable; highlight supportive habits */
const LOSS_WEIGHT_DECREASED_RULES = [
  atOrBelowTargetRule({
    id: 'loss_down_calories_deficit',
    parameter: 'calories',
    impactScoreKey: 'calories_deficit',
    explanation: 'Calorie intake was at or below your target — likely supporting your weight loss.',
  }),
  atOrAboveTargetRule({
    id: 'loss_down_protein_met',
    parameter: 'protein',
    lowMultiplierKey: 'proteinLow',
    impactScoreKey: 'protein_met',
    explanation: 'Protein intake met your target — a positive contributor to your progress.',
  }),
  atOrAboveTargetRule({
    id: 'loss_down_water_met',
    parameter: 'water',
    lowMultiplierKey: 'waterLow',
    impactScoreKey: 'water_met',
    explanation: 'Water intake met your target — a positive contributor to your progress.',
  }),
];

/** Gain goal + weight decreased — failed to gain; under-target macros */
const GAIN_WEIGHT_DECREASED_RULES = [
  underTargetRule({
    id: 'gain_down_calories_under',
    parameter: 'calories',
    lowMultiplierKey: 'proteinLow',
    impactScoreKey: 'calories_under',
    explanation: 'Calorie intake was below your target — a likely factor in not gaining weight.',
    significantOnly: false,
  }),
  underTargetRule({
    id: 'gain_down_protein_under',
    parameter: 'protein',
    lowMultiplierKey: 'proteinLow',
    impactScoreKey: 'protein_under_gain',
    explanation: 'Protein intake was below your target — a likely factor in not gaining weight.',
  }),
  underTargetRule({
    id: 'gain_down_carbs_under',
    parameter: 'carbs',
    lowMultiplierKey: 'proteinLow',
    impactScoreKey: 'carbs_under',
    explanation: 'Carbohydrate intake was below your target — a possible contributor.',
    significantOnly: false,
  }),
  underTargetRule({
    id: 'gain_down_fat_under',
    parameter: 'fat',
    lowMultiplierKey: 'proteinLow',
    impactScoreKey: 'fat_under',
    explanation: 'Fat intake was below your target — a possible contributor.',
    significantOnly: false,
  }),
  underTargetRule({
    id: 'gain_down_water_under',
    parameter: 'water',
    lowMultiplierKey: 'waterLow',
    impactScoreKey: 'water_under',
    explanation: 'Water intake was significantly below your target — a possible contributor.',
    significantOnly: true,
  }),
];

/** Gain goal + weight increased — favorable progress */
const GAIN_WEIGHT_INCREASED_RULES = [
  atOrAboveTargetRule({
    id: 'gain_up_calories_met',
    parameter: 'calories',
    lowMultiplierKey: 'proteinLow',
    impactScoreKey: 'calories_deficit',
    explanation: 'Calorie intake met your target — likely supporting your weight gain.',
  }),
  atOrAboveTargetRule({
    id: 'gain_up_protein_met',
    parameter: 'protein',
    lowMultiplierKey: 'proteinLow',
    impactScoreKey: 'protein_met',
    explanation: 'Protein intake met your target — a positive contributor to your progress.',
  }),
  atOrAboveTargetRule({
    id: 'gain_up_carbs_met',
    parameter: 'carbs',
    lowMultiplierKey: 'proteinLow',
    impactScoreKey: 'carbs_met',
    explanation: 'Carbohydrate intake met your target — a positive contributor to your progress.',
  }),
  atOrAboveTargetRule({
    id: 'gain_up_fat_met',
    parameter: 'fat',
    lowMultiplierKey: 'proteinLow',
    impactScoreKey: 'fat_met',
    explanation: 'Fat intake met your target — a positive contributor to your progress.',
  }),
];

const MAINTENANCE_RULES = ['calories', 'protein', 'carbs', 'fat', 'water'].map((p) =>
  maintenanceDeviationRule({ parameter: p })
);

/**
 * Select rule set based on goal + weight trend.
 * @param {RuleContext} ctx
 * @returns {InsightRule[]}
 */
export function selectRulesForContext(ctx) {
  if (ctx.weightTrend === 'first' || ctx.weightTrend === 'stable') {
    return ctx.goal === 'maintain' ? MAINTENANCE_RULES : [];
  }

  if (ctx.goal === 'loss') {
    return ctx.weightTrend === 'increase'
      ? LOSS_WEIGHT_INCREASED_RULES
      : LOSS_WEIGHT_DECREASED_RULES;
  }

  if (ctx.goal === 'gain') {
    return ctx.weightTrend === 'decrease'
      ? GAIN_WEIGHT_DECREASED_RULES
      : GAIN_WEIGHT_INCREASED_RULES;
  }

  return MAINTENANCE_RULES;
}

/**
 * Run all rules, rank matches, return top reasons.
 * @param {RuleContext} ctx
 * @returns {object[]}
 */
export function evaluateRules(ctx) {
  const rules = selectRulesForContext(ctx);
  const matched = [];

  for (const rule of rules) {
    const result = rule.evaluate(ctx);
    if (result) matched.push(result);
  }

  return matched
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, ctx.config.maxReasons);
}

function resolveStatus(goal, weightTrend) {
  if (weightTrend === 'first') return 'first_upload';
  if (weightTrend === 'stable') return 'stable';

  const unfavorable =
    (goal === 'loss' && weightTrend === 'increase') ||
    (goal === 'gain' && weightTrend === 'decrease');

  return unfavorable ? 'reverse_progress' : 'favorable_progress';
}

function resolveSectionTitle(goal, weightTrend) {
  if (weightTrend === 'first') return null;

  if (goal === 'loss' && weightTrend === 'increase') {
    return 'Possible contributors to weight gain';
  }
  if (goal === 'loss' && weightTrend === 'decrease') {
    return 'What likely supported your weight loss';
  }
  if (goal === 'gain' && weightTrend === 'decrease') {
    return 'Possible reasons you did not gain weight';
  }
  if (goal === 'gain' && weightTrend === 'increase') {
    return 'What likely supported your weight gain';
  }
  return 'Nutrition insights';
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate structured weight insights from raw inputs.
 *
 * @param {{
 *   goal: string,
 *   previousWeight?: number|null,
 *   currentWeight?: number|null,
 *   nutrition?: object,
 *   targets?: object,
 *   config?: typeof WEIGHT_INSIGHT_CONFIG,
 * }} input
 */
export function generateWeightInsights({
  goal,
  previousWeight = null,
  currentWeight = null,
  nutrition = {},
  targets = {},
  config = WEIGHT_INSIGHT_CONFIG,
}) {
  const normalizedGoal = normalizeGoal(goal);
  const weightTrend = determineWeightTrend(previousWeight, currentWeight, config);
  const prev = previousWeight != null ? safeNumber(previousWeight) : null;
  const curr = currentWeight != null ? safeNumber(currentWeight) : null;
  const weightDifference =
    prev != null && curr != null ? Number((curr - prev).toFixed(2)) : 0;

  const ctx = {
    goal: normalizedGoal,
    weightTrend,
    previousWeight: prev,
    currentWeight: curr,
    weightDifference,
    nutrition: buildNutritionSnapshot(nutrition),
    targets: buildTargetSnapshot(targets),
    config,
  };

  const reasons = weightTrend === 'first' ? [] : evaluateRules(ctx);

  return {
    status: resolveStatus(normalizedGoal, weightTrend),
    weightTrend,
    weightDifference,
    goal: normalizedGoal,
    sectionTitle: resolveSectionTitle(normalizedGoal, weightTrend),
    emptyMessage: EMPTY_INSIGHT_MESSAGE,
    disclaimer: INSIGHT_DISCLAIMER,
    reasons,
  };
}

/**
 * Adapter: map existing API comparison payload → engine input.
 * Keeps modal free of field-mapping logic.
 */
export function generateWeightInsightsFromComparison(comparison, goalMode) {
  if (!comparison) {
    return generateWeightInsights({ goal: goalMode || 'maintain' });
  }

  const yNutrition = comparison.nutrition?.yesterday || {};
  const water = comparison.water || {};
  const targets = comparison.targets || {};
  const weight = comparison.weight || {};

  const isFirst = weight.direction === 'first';

  return generateWeightInsights({
    goal: goalMode || 'maintain',
    previousWeight: isFirst ? null : weight.previous,
    currentWeight: weight.current,
    nutrition: {
      calories: yNutrition.calories,
      protein: yNutrition.protein,
      carbs: yNutrition.carbs,
      fat: yNutrition.fat,
      water: water.yesterday,
    },
    targets: {
      calories: targets.calories,
      protein: targets.protein,
      carbs: targets.carbs,
      fat: targets.fat,
      water: targets.water ?? water.target,
    },
  });
}
