/**
 * NutritionCarousel — 7-card horizontal swipe carousel for the nutrition dashboard.
 *
 * Cards (in order):
 *   0 — Wellness Score  (when ff.wellness-score-sheet is enabled)
 *   1 — Calories       (BMR target, consumed, exercise=0, remaining)
 *   1 — Macros         (protein/fat/carbs; fat = calorieTarget × 20%|30% / 9)
 *   2 — Heart Healthy  (fat, sodium ≤2300mg, cholesterol ≤300mg)
 *   3 — Low Carb       (GI, sugar ≤50g, fiber ≥25g; carbs in footer)
 *   4 — Vitamins A–K   (A, C, D, E, K vs. adult RDA)
 *   5 — B Vitamins     (B1, B2, B3, B6, B9, B12 vs. adult RDA)
 *   6 — Minerals       (Ca, Fe, Mg, K, Zn, P vs. adult RDA)
 *
 * (Glycemic Index carousel card disabled — GI is on the Low Carb card instead.
 *  To re-enable: uncomment GICard import/usage below and add 'Glycemic Index' to CARD_LABELS.)
 *
 * Gesture: pointer-based swipe (≥36px), mirrors useSwipePanelHeight pattern.
 * Keeps the active card when the date range filter changes so only card data reloads.
 */
import React, { useMemo } from 'react';
import {
  computeCaloriesCard,
  computeMacroTargets,
  computeHeartHealthyCard,
  computeLowCarbCard,
  // computeGICard, // disabled — GI moved to Low Carb card
} from '../../domain/carouselRules';
import {
  computeVitaminsFatSolubleCard,
  computeVitaminsBComplexCard,
  computeMineralsCard,
} from '../../domain/micronutrientRules';
import { scaleMicronutrientTiles } from '../../domain/carouselPeriodProgress';
import { useCarouselSwipe } from '../../hooks/useCarouselSwipe';
import CaloriesCard   from './carousel/CaloriesCard';
import MacrosCard     from './carousel/MacrosCard';
import HeartHealthyCard from './carousel/HeartHealthyCard';
import LowCarbCard    from './carousel/LowCarbCard';
// import GICard         from './carousel/GICard'; // disabled — GI moved to Low Carb card
import VitaminsFatSolubleCard from './carousel/VitaminsFatSolubleCard';
import VitaminsBComplexCard   from './carousel/VitaminsBComplexCard';
import MineralsCard           from './carousel/MineralsCard';
import NutrientBreakdownModals, { useNutrientBreakdownModal } from '../NutrientBreakdownModals';

const NUTRITION_CARD_LABELS = [
  'Calories', 'Macros', 'Heart Healthy', 'Low Carb',
  'Vitamins A-K', 'B Vitamins', 'Minerals',
];

const NutritionCarousel = ({
  calorieTarget,
  consumedCalories,
  burnedCalories,
  dailyStats,
  latestWeight,
  gender = null,
  analyses = [],
  leadingCard = null,
  leadingCardLabel = 'Wellness Score',
  periodContext = null,
}) => {
  const goalScale = periodContext?.goalScale ?? 1;

  const scaleTarget = (value) => {
    if (value == null) return null;
    return Math.round(value * goalScale);
  };

  const scaleLimitNutrient = (nutrient) => ({
    ...nutrient,
    target: nutrient.target != null ? Math.round(nutrient.target * goalScale) : null,
    pct: nutrient.target != null && nutrient.target > 0
      ? Math.min(100, Math.round((nutrient.consumed / (nutrient.target * goalScale)) * 100))
      : nutrient.pct,
  });
  const { modalState, handleOpenModal, handleCloseModal } = useNutrientBreakdownModal();

  // Derive values from domain rules (pure)
  const calCard = computeCaloriesCard({
    calorieTarget: calorieTarget * goalScale,
    consumedCalories: consumedCalories || dailyStats?.totalCalories || 0,
    burnedCalories: burnedCalories || 0,
  });

  const { proteinTarget, fatTarget, carbsTarget } = computeMacroTargets({
    latestWeight,
    calorieTarget,
    gender,
  });
  const scaledProteinTarget = scaleTarget(proteinTarget);
  const scaledFatTarget = scaleTarget(fatTarget);
  const scaledCarbsTarget = scaleTarget(carbsTarget);

  const heartCardRaw = computeHeartHealthyCard({
    consumedFat:         dailyStats?.totalFat         || 0,
    consumedSodium:      dailyStats?.totalSodium      || 0,
    consumedCholesterol: dailyStats?.totalCholesterol || 0,
    fatTarget,
    weight: latestWeight,
  });
  const heartCard = {
    fat: scaleLimitNutrient(heartCardRaw.fat),
    sodium: scaleLimitNutrient(heartCardRaw.sodium),
    cholesterol: scaleLimitNutrient(heartCardRaw.cholesterol),
  };

  const lowCarbCardRaw = computeLowCarbCard({
    consumedCarbs: dailyStats?.totalCarbs || 0,
    consumedSugar: dailyStats?.totalSugar || 0,
    consumedFiber: dailyStats?.totalFiber || 0,
    carbsTarget,
    calorieTarget,
  });
  const lowCarbCard = {
    carbs: scaleLimitNutrient(lowCarbCardRaw.carbs),
    sugar: scaleLimitNutrient(lowCarbCardRaw.sugar),
    fiber: {
      ...lowCarbCardRaw.fiber,
      target: Math.round(lowCarbCardRaw.fiber.target * goalScale),
      pct: Math.min(100, Math.round(
        ((lowCarbCardRaw.fiber.consumed || 0) / Math.max(lowCarbCardRaw.fiber.target * goalScale, 1)) * 100,
      )),
    },
  };

  const vitFatTiles  = scaleMicronutrientTiles(computeVitaminsFatSolubleCard(dailyStats || {}), goalScale);
  const vitBTiles    = scaleMicronutrientTiles(computeVitaminsBComplexCard(dailyStats || {}), goalScale);
  const mineralTiles = scaleMicronutrientTiles(computeMineralsCard(dailyStats || {}), goalScale);

  const cardLabels = leadingCard
    ? [leadingCardLabel, ...NUTRITION_CARD_LABELS]
    : NUTRITION_CARD_LABELS;

  // Do not reset on date/range change — stay on Calories (etc.) while period data reloads.
  const { activeIndex, swipeHandlers } = useCarouselSwipe({
    cardCount: cardLabels.length,
  });

  // Memoize cards to prevent re-renders on swipe (only transform changes)
  const cards = useMemo(
    () => {
      const nutritionCards = [
      <CaloriesCard key="calories" {...calCard} periodContext={periodContext} onOpenModal={handleOpenModal} />,
      <MacrosCard
        key="macros"
        consumedProtein={dailyStats?.totalProtein || 0}
        consumedFat={dailyStats?.totalFat        || 0}
        consumedCarbs={dailyStats?.totalCarbs    || 0}
        proteinTarget={scaledProteinTarget}
        fatTarget={scaledFatTarget}
        carbsTarget={scaledCarbsTarget}
        periodContext={periodContext}
        onOpenModal={handleOpenModal}
      />,
      <HeartHealthyCard key="heart" fat={heartCard.fat} sodium={heartCard.sodium} cholesterol={heartCard.cholesterol} periodContext={periodContext} onOpenModal={handleOpenModal} />,
      <LowCarbCard
        key="lowcarb"
        carbs={lowCarbCard.carbs}
        sugar={lowCarbCard.sugar}
        fiber={lowCarbCard.fiber}
        glycemicIndex={dailyStats?.averageGlycemicIndex ?? null}
        periodContext={periodContext}
        onOpenModal={handleOpenModal}
      />,
      <VitaminsFatSolubleCard key="vit-fat" tiles={vitFatTiles} periodContext={periodContext} onOpenModal={handleOpenModal} />,
      <VitaminsBComplexCard   key="vit-b"   tiles={vitBTiles} periodContext={periodContext} onOpenModal={handleOpenModal} />,
      <MineralsCard           key="minerals" tiles={mineralTiles} periodContext={periodContext} onOpenModal={handleOpenModal} />,
      ];
      return leadingCard ? [leadingCard, ...nutritionCards] : nutritionCards;
    },
    [
      calCard.target, calCard.consumed, calCard.exercise, calCard.remaining,
      scaledProteinTarget, scaledFatTarget, scaledCarbsTarget,
      periodContext,
      dailyStats?.totalProtein, dailyStats?.totalFat, dailyStats?.totalCarbs,
      dailyStats?.averageGlycemicIndex,
      heartCard.fat, heartCard.sodium, heartCard.cholesterol,
      lowCarbCard.carbs, lowCarbCard.sugar, lowCarbCard.fiber,
      vitFatTiles, vitBTiles, mineralTiles,
      leadingCard, handleOpenModal,
    ],
  );

  return (
    <div className="mb-1.5 px-2 md:mb-1.5 md:px-3">
      <div
        className="mx-auto w-full max-w-md overflow-hidden rounded-xl border border-gray-100 bg-white/70 shadow-md backdrop-blur-xl"
        {...swipeHandlers}
        style={{ touchAction: 'pan-y' }}
      >
        {/* Slide track with peek effect (next card only) */}
        <div className="overflow-hidden">
          <div
            className="flex gap-3 transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(calc(-${activeIndex} * (85% + 0.75rem)))`,
            }}
          >
            {cards.map((card, i) => (
              <div
                key={i}
                className={`${i === cards.length - 1 ? 'w-full' : 'w-[85%]'} min-h-[148px] flex-shrink-0 px-1.5 min-[360px]:px-2`}
              >
                {card}
              </div>
            ))}
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-1.5 py-0.5">
          {cardLabels.map((label, i) => (
            <div
              key={label}
              className={`rounded-full transition-all duration-200 ${
                i === activeIndex
                  ? 'w-2 h-1 bg-emerald-500'
                  : 'w-1 h-1 bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>

      <NutrientBreakdownModals
        isOpen={modalState.isOpen}
        nutrient={modalState.nutrient}
        onClose={handleCloseModal}
        analyses={analyses}
        dailyStats={dailyStats}
        calCard={calCard}
        proteinTarget={scaledProteinTarget}
        fatTarget={scaledFatTarget}
        carbsTarget={scaledCarbsTarget}
        calorieTarget={calCard.target}
        heartCard={heartCard}
        lowCarbCard={lowCarbCard}
      />
    </div>
  );
};

export default NutritionCarousel;
