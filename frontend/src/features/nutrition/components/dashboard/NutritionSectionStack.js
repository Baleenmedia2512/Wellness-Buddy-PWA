/**
 * NutritionSectionStack — stacked nutrition cards for the Reports Nutrition tab.
 * Reuses Home carousel cards + domain compute helpers. No new RDA / GI / macro math.
 */
import React, { useMemo } from 'react';
import {
  computeMacroTargets,
  computeHeartHealthyCard,
  computeLowCarbCard,
} from '../../domain/carouselRules';
import {
  computeVitaminsFatSolubleCard,
  computeVitaminsBComplexCard,
  computeMineralsCard,
} from '../../domain/micronutrientRules';
import MacrosCard from './carousel/MacrosCard';
import MineralsCard from './carousel/MineralsCard';
import VitaminsBComplexCard from './carousel/VitaminsBComplexCard';
import VitaminsFatSolubleCard from './carousel/VitaminsFatSolubleCard';
import LowCarbCard from './carousel/LowCarbCard';
import HeartHealthyCard from './carousel/HeartHealthyCard';

export default function NutritionSectionStack({
  calorieTarget,
  dailyStats,
  latestWeight,
  gender = null,
}) {
  const { proteinTarget, fatTarget, carbsTarget } = useMemo(
    () => computeMacroTargets({ latestWeight, calorieTarget, gender }),
    [latestWeight, calorieTarget, gender],
  );

  const heartCard = useMemo(
    () => computeHeartHealthyCard({
      consumedFat: dailyStats?.totalFat || 0,
      consumedSodium: dailyStats?.totalSodium || 0,
      consumedCholesterol: dailyStats?.totalCholesterol || 0,
      fatTarget,
      weight: latestWeight,
    }),
    [dailyStats, fatTarget, latestWeight],
  );

  const lowCarbCard = useMemo(
    () => computeLowCarbCard({
      consumedCarbs: dailyStats?.totalCarbs || 0,
      consumedSugar: dailyStats?.totalSugar || 0,
      consumedFiber: dailyStats?.totalFiber || 0,
      carbsTarget,
      calorieTarget,
    }),
    [dailyStats, carbsTarget, calorieTarget],
  );

  const vitFatTiles = useMemo(
    () => computeVitaminsFatSolubleCard(dailyStats || {}),
    [dailyStats],
  );
  const vitBTiles = useMemo(
    () => computeVitaminsBComplexCard(dailyStats || {}),
    [dailyStats],
  );
  const mineralTiles = useMemo(
    () => computeMineralsCard(dailyStats || {}),
    [dailyStats],
  );

  return (
    <div className="space-y-3">
      <MacrosCard
        consumedProtein={dailyStats?.totalProtein || 0}
        consumedFat={dailyStats?.totalFat || 0}
        consumedCarbs={dailyStats?.totalCarbs || 0}
        proteinTarget={proteinTarget}
        fatTarget={fatTarget}
        carbsTarget={carbsTarget}
      />
      <MineralsCard tiles={mineralTiles} />
      <VitaminsBComplexCard tiles={vitBTiles} layout="row" />
      <VitaminsFatSolubleCard tiles={vitFatTiles} />
      <LowCarbCard
        carbs={lowCarbCard.carbs}
        sugar={lowCarbCard.sugar}
        fiber={lowCarbCard.fiber}
        glycemicIndex={dailyStats?.averageGlycemicIndex ?? null}
      />
      <HeartHealthyCard
        fat={heartCard.fat}
        sodium={heartCard.sodium}
        cholesterol={heartCard.cholesterol}
      />
    </div>
  );
}
