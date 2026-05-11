import { isExemptedBeverageOnly, isExemptedFood } from '../../utils/foodTypeDetection.js';
import * as repo from './water.repository.js';

const DEFAULT_REQUIRED_ML = 2500;

export async function getIntake({ userId, date }) {
  const weightRow = await repo.getLatestWeight(userId);
  const latestWeight = weightRow ? parseFloat(weightRow.Weight) : null;
  const hasWeight = latestWeight !== null && !isNaN(latestWeight) && latestWeight > 0;
  const requiredMl = hasWeight ? Math.round((latestWeight / 20) * 1000) : DEFAULT_REQUIRED_ML;

  const foodRows = await repo.getFoodRowsForDate(userId, date);
  const waterRecords = foodRows.filter((r) => isExemptedBeverageOnly(r.AnalysisData));

  let totalMl = 0;
  const logs = [];

  waterRecords.forEach((record) => {
    try {
      const ad = typeof record.AnalysisData === 'string'
        ? JSON.parse(record.AnalysisData)
        : record.AnalysisData;
      const foods = ad?.foods || [];
      let recordMl = 0;

      foods.forEach((food) => {
        if (isExemptedFood(food.name)) {
          const ml = parseFloat(food.volume_ml) || parseFloat(food.weight_g) || parseFloat(food.estimatedWeight) || 0;
          recordMl += ml;
          totalMl += ml;
        }
      });

      if (recordMl > 0) {
        logs.push({
          loggedAt: record.CreatedAt,
          volumeMl: recordMl,
          items: foods
            .filter((f) => isExemptedFood(f.name))
            .map((f) => ({ name: f.name, volumeMl: parseFloat(f.volume_ml) || 0 })),
        });
      }
    } catch (parseErr) {
      console.warn('[water] AnalysisData parse error:', parseErr.message);
    }
  });

  const remainingMl = Math.max(0, requiredMl - totalMl);
  const achieved = totalMl >= requiredMl;

  return {
    httpStatus: 200,
    body: {
      date,
      userId: parseInt(userId, 10),
      weightKg: hasWeight ? latestWeight : null,
      defaultWeight: !hasWeight,
      requiredMl,
      totalMl: Math.round(totalMl),
      remainingMl: Math.round(remainingMl),
      achieved,
      progressPercent: Math.min(100, Math.round((totalMl / requiredMl) * 100)),
      logCount: logs.length,
      logs,
    },
  };
}
