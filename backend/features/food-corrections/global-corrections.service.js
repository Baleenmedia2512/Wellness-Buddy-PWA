/**
 * Hybrid global-corrections logic.
 * Returns global Herbalife corrections + user-specific corrections, with user
 * overrides always winning. Logic preserved from original get-global-corrections.js.
 */

function getRowValue(row, ...keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return null;
}

function normalizeFoodName(name) {
  if (!name) return '';
  return name.toLowerCase().trim()
    .replace(/[-–—_()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isHerbalife(foodName) {
  if (!foodName) return false;
  return foodName.toLowerCase().replace(/\s+/g, '').includes('herbalife');
}

function pickFields(row) {
  return {
    aiDetected: getRowValue(row, 'AiDetected', 'aidetected', 'ai_detected'),
    userCorrected: getRowValue(row, 'UserCorrected', 'usercorrected', 'user_corrected'),
    userId: getRowValue(row, 'UserId', 'userid', 'user_id'),
    timesCorrected: getRowValue(row, 'TimesCorrected', 'timescorrected', 'times_corrected') || 1,
    lastCorrected: getRowValue(row, 'LastCorrected', 'lastcorrected', 'last_corrected'),
    correctedQuantity: getRowValue(row, 'CorrectedQuantity', 'correctedquantity', 'corrected_quantity'),
    correctedUnit: getRowValue(row, 'CorrectedUnit', 'correctedunit', 'corrected_unit'),
    correctedFoodType: getRowValue(row, 'CorrectedFoodType', 'correctedfoodtype', 'corrected_food_type'),
    correctedCalories: getRowValue(row, 'CorrectedCalories', 'correctedcalories', 'corrected_calories'),
    correctedCarbs: getRowValue(row, 'CorrectedCarbs', 'correctedcarbs', 'corrected_carbs'),
    correctedProtein: getRowValue(row, 'CorrectedProtein', 'correctedprotein', 'corrected_protein'),
    correctedFat: getRowValue(row, 'CorrectedFat', 'correctedfat', 'corrected_fat'),
    correctedFiber: getRowValue(row, 'CorrectedFiber', 'correctedfiber', 'corrected_fiber'),
  };
}

function buildPattern(c, allCorrections) {
  const uniqueUsers = new Set(
    allCorrections
      .filter((x) => normalizeFoodName(x.userCorrected) === normalizeFoodName(c.userCorrected))
      .map((x) => x.userId)
  );
  return {
    aiDetected: c.aiDetected,
    userCorrected: c.userCorrected,
    users: uniqueUsers,
    totalCorrections: c.timesCorrected,
    lastCorrected: c.lastCorrected,
    lastCorrectedByUserId: c.userId,
    correctedQuantity: c.correctedQuantity,
    correctedUnit: c.correctedUnit,
    correctedFoodType: c.correctedFoodType,
    correctedCalories: c.correctedCalories,
    correctedCarbs: c.correctedCarbs,
    correctedProtein: c.correctedProtein,
    correctedFat: c.correctedFat,
    correctedFiber: c.correctedFiber,
  };
}

export function buildGlobalCorrections(allCorrectionsRaw, requestingUserId) {
  const aiDetectionMap = new Map();
  for (const row of allCorrectionsRaw) {
    const fields = pickFields(row);
    const normalizedAi = normalizeFoodName(fields.aiDetected);
    if (!aiDetectionMap.has(normalizedAi)) aiDetectionMap.set(normalizedAi, []);
    aiDetectionMap.get(normalizedAi).push(fields);
  }

  const globalCorrectionMap = new Map();
  const userCorrectionMap = new Map();

  aiDetectionMap.forEach((corrections, normalizedAi) => {
    const sorted = corrections.slice().sort((a, b) =>
      new Date(b.lastCorrected) - new Date(a.lastCorrected)
    );
    const hasHerbalife = sorted.some((c) => isHerbalife(c.userCorrected));

    // Priority 1: user's own correction
    if (requestingUserId) {
      const userCorr = sorted.find((c) => String(c.userId) === String(requestingUserId));
      if (userCorr) {
        userCorrectionMap.set(normalizedAi, buildPattern(userCorr, corrections));
      }
    }

    // Priority 2: global Herbalife correction
    if (hasHerbalife && !userCorrectionMap.has(normalizedAi)) {
      const herbalifeCorr = sorted.find((c) => isHerbalife(c.userCorrected));
      if (herbalifeCorr) {
        globalCorrectionMap.set(normalizedAi, buildPattern(herbalifeCorr, corrections));
      }
    }
  });

  // Merge: user overrides global
  const finalMap = new Map();
  globalCorrectionMap.forEach((p, k) => finalMap.set(k, { ...p, isGlobal: true }));
  userCorrectionMap.forEach((p, k) => finalMap.set(k, { ...p, isGlobal: false }));

  const allPatterns = Array.from(finalMap.values()).map((p) => ({
    ai_detected: p.aiDetected,
    user_corrected: p.userCorrected,
    user_count: p.users.size,
    total_corrections: p.totalCorrections,
    last_corrected_by_user_id: p.lastCorrectedByUserId,
    last_corrected: p.lastCorrected,
    is_global: p.isGlobal,
    confidence: 1.0,
    corrected_quantity: p.correctedQuantity,
    corrected_unit: p.correctedUnit,
    corrected_food_type: p.correctedFoodType,
    corrected_calories: p.correctedCalories,
    corrected_carbs: p.correctedCarbs,
    corrected_protein: p.correctedProtein,
    corrected_fat: p.correctedFat,
    corrected_fiber: p.correctedFiber,
  }));

  const correctionLookup = {};
  allPatterns.forEach((pattern) => {
    const key = pattern.ai_detected.toLowerCase().trim();
    correctionLookup[key] = {
      correctedName: pattern.user_corrected,
      userCount: pattern.user_count,
      totalCorrections: pattern.total_corrections,
      lastCorrectedByUserId: pattern.last_corrected_by_user_id,
      lastCorrected: pattern.last_corrected,
      isGlobal: pattern.is_global,
      confidence: pattern.confidence,
      correctedQuantity: pattern.corrected_quantity,
      correctedUnit: pattern.corrected_unit,
      correctedFoodType: pattern.corrected_food_type,
      correctedCalories: pattern.corrected_calories,
      correctedCarbs: pattern.corrected_carbs,
      correctedProtein: pattern.corrected_protein,
      correctedFat: pattern.corrected_fat,
      correctedFiber: pattern.corrected_fiber,
    };
  });

  return {
    success: true,
    patterns: allPatterns,
    lookup: correctionLookup,
    count: allPatterns.length,
    globalCount: globalCorrectionMap.size,
    userCount: userCorrectionMap.size,
    threshold: 1,
  };
}
