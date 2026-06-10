/**
 * NutritionCarousel — 8-card horizontal swipe carousel for the nutrition dashboard.
 *
 * Cards (in order):
 *   0 — Calories       (BMR target, consumed, exercise=0, remaining)
 *   1 — Macros         (protein/fat/carbs with weight-derived targets)
 *   2 — Heart Healthy  (fat, sodium ≤2300mg, cholesterol ≤300mg)
 *   3 — Low Carb       (carbs, sugar ≤50g, fiber ≥25g)
 *   4 — Glycemic Index (average GI with Low/Medium/High zones)
 *   5 — Vitamins A–K   (A, C, D, E, K vs. adult RDA)
 *   6 — B Vitamins     (B1, B2, B3, B6, B9, B12 vs. adult RDA)
 *   7 — Minerals       (Ca, Fe, Mg, K, Zn, P vs. adult RDA)
 *
 * Gesture: pointer-based swipe (≥36px), mirrors useSwipePanelHeight pattern.
 * Resets to card 0 when selectedDate changes.
 */
import React, { useMemo, useState } from 'react';
import {
  computeCaloriesCard,
  computeMacroTargets,
  computeHeartHealthyCard,
  computeLowCarbCard,
  computeGICard,
} from '../../domain/carouselRules';
import {
  computeVitaminsFatSolubleCard,
  computeVitaminsBComplexCard,
  computeMineralsCard,
} from '../../domain/micronutrientRules';
import { useCarouselSwipe } from '../../hooks/useCarouselSwipe';
import CaloriesCard   from './carousel/CaloriesCard';
import MacrosCard     from './carousel/MacrosCard';
import HeartHealthyCard from './carousel/HeartHealthyCard';
import LowCarbCard    from './carousel/LowCarbCard';
import GICard         from './carousel/GICard';
import VitaminsFatSolubleCard from './carousel/VitaminsFatSolubleCard';
import VitaminsBComplexCard   from './carousel/VitaminsBComplexCard';
import MineralsCard           from './carousel/MineralsCard';
import FoodBreakdownModal from '../FoodBreakdownModal';

const CARD_LABELS = [
  'Calories', 'Macros', 'Heart Healthy', 'Low Carb', 'Glycemic Index',
  'Vitamins A-K', 'B Vitamins', 'Minerals',
];

const NutritionCarousel = ({
  calorieTarget,
  consumedCalories,
  burnedCalories,
  dailyStats,
  latestWeight,
  selectedDate,
  analyses = [],
}) => {
  // Modal state for food breakdown
  const [modalState, setModalState] = useState({ isOpen: false, nutrient: null });

  const handleOpenModal = (nutrientType) => {
    setModalState({ isOpen: true, nutrient: nutrientType });
  };

  const handleCloseModal = () => {
    setModalState({ isOpen: false, nutrient: null });
  };

  // Derive values from domain rules (pure)
  const calCard = computeCaloriesCard({
    calorieTarget,
    consumedCalories: consumedCalories || dailyStats?.totalCalories || 0,
    burnedCalories: burnedCalories || 0,
  });

  const { proteinTarget, fatTarget, carbsTarget } = computeMacroTargets({
    latestWeight,
    calorieTarget,
  });

  const heartCard = computeHeartHealthyCard({
    consumedFat:         dailyStats?.totalFat         || 0,
    consumedSodium:      dailyStats?.totalSodium      || 0,
    consumedCholesterol: dailyStats?.totalCholesterol || 0,
    fatTarget,
    weight: latestWeight,
  });

  const lowCarbCard = computeLowCarbCard({
    consumedCarbs: dailyStats?.totalCarbs || 0,
    consumedSugar: dailyStats?.totalSugar || 0,
    consumedFiber: dailyStats?.totalFiber || 0,
    carbsTarget,
    calorieTarget,
  });

  const giCard = computeGICard({
    averageGlycemicIndex: dailyStats?.averageGlycemicIndex ?? null,
    mealCount: dailyStats?.mealCount || 0,
  });

  const vitFatTiles  = computeVitaminsFatSolubleCard(dailyStats || {});
  const vitBTiles    = computeVitaminsBComplexCard(dailyStats || {});
  const mineralTiles = computeMineralsCard(dailyStats || {});

  const { activeIndex, goTo, swipeHandlers } = useCarouselSwipe({
    cardCount: CARD_LABELS.length,
    resetKey: selectedDate,
  });

  // Memoize cards to prevent re-renders on swipe (only transform changes)
  const cards = useMemo(
    () => [
      <CaloriesCard key="calories" {...calCard} />,
      <MacrosCard
        key="macros"
        consumedProtein={dailyStats?.totalProtein || 0}
        consumedFat={dailyStats?.totalFat        || 0}
        consumedCarbs={dailyStats?.totalCarbs    || 0}
        proteinTarget={proteinTarget}
        fatTarget={fatTarget}
        carbsTarget={carbsTarget}
        glycemicIndex={dailyStats?.averageGlycemicIndex ?? null}
        analyses={analyses}
        onOpenModal={handleOpenModal}
      />,
      <HeartHealthyCard key="heart"   fat={heartCard.fat} sodium={heartCard.sodium} cholesterol={heartCard.cholesterol} />,
      <LowCarbCard      key="lowcarb" carbs={lowCarbCard.carbs} sugar={lowCarbCard.sugar} fiber={lowCarbCard.fiber} />,
      <GICard           key="gi"      averageGI={giCard.averageGI} mealCount={giCard.mealCount} />,
      <VitaminsFatSolubleCard key="vit-fat" tiles={vitFatTiles} />,
      <VitaminsBComplexCard   key="vit-b"   tiles={vitBTiles} />,
      <MineralsCard           key="minerals" tiles={mineralTiles} />,
    ],
    [
      calCard.target, calCard.consumed, calCard.exercise, calCard.remaining,
      proteinTarget, fatTarget, carbsTarget,
      dailyStats?.totalProtein, dailyStats?.totalFat, dailyStats?.totalCarbs,
      dailyStats?.averageGlycemicIndex,
      heartCard.fat, heartCard.sodium, heartCard.cholesterol,
      lowCarbCard.carbs, lowCarbCard.sugar, lowCarbCard.fiber,
      giCard.averageGI, giCard.mealCount,
      vitFatTiles, vitBTiles, mineralTiles,
      analyses,
    ],
  );

  return (
    <div className="px-2 md:px-3 mb-1.5">
      <div
        className="w-full max-w-md mx-auto bg-white/70 backdrop-blur-xl rounded-xl shadow-md border border-gray-100 overflow-hidden"
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
                className={`${i === cards.length - 1 ? 'w-full' : 'w-[85%]'} flex-shrink-0 min-h-[148px] px-2`}
              >
                {card}
              </div>
            ))}
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-1.5 py-0.5">
          {CARD_LABELS.map((label, i) => (
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

      {/* Food Breakdown Modal - rendered at carousel level for full-screen bottom sheet */}
      <FoodBreakdownModal
        isOpen={modalState.isOpen}
        onClose={handleCloseModal}
        nutrientName={
          modalState.nutrient === 'protein' ? 'Protein' :
          modalState.nutrient === 'fat' ? 'Fat' :
          modalState.nutrient === 'carbs' ? 'Carbs' : ''
        }
        unit="g"
        totalConsumed={
          modalState.nutrient === 'protein' ? (dailyStats?.totalProtein || 0) :
          modalState.nutrient === 'fat' ? (dailyStats?.totalFat || 0) :
          modalState.nutrient === 'carbs' ? (dailyStats?.totalCarbs || 0) : 0
        }
        target={
          modalState.nutrient === 'protein' ? (proteinTarget || 0) :
          modalState.nutrient === 'fat' ? (fatTarget || 0) :
          modalState.nutrient === 'carbs' ? (carbsTarget || 0) : 0
        }
        foodBreakdown={
          modalState.isOpen ? (
            modalState.nutrient === 'protein' ? extractFoodContributions(analyses, 'protein').breakdown :
            modalState.nutrient === 'fat' ? extractFoodContributions(analyses, 'fat').breakdown :
            modalState.nutrient === 'carbs' ? extractFoodContributions(analyses, 'carbs').breakdown : []
          ) : []
        }
      />
    </div>
  );
};

/**
 * Helper to parse AnalysisData from DB
 */
const parseAnalysisData = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

/**
 * Extract foods and their nutrient contributions from analyses
 */
const extractFoodContributions = (analyses, nutrientKey) => {
  const foods = [];
  let total = 0;

  analyses.forEach((analysis) => {
    if (analysis.isUndoPlaceholder) return;
    const data = parseAnalysisData(analysis.AnalysisData);
    const foodList = data.foods || [];

    foodList.forEach((food) => {
      const nutrition = food.nutrition || {};
      let amount = 0;

      if (nutrientKey === 'protein') {
        amount = nutrition.protein || 0;
      } else if (nutrientKey === 'fat') {
        amount = nutrition.fat || 0;
      } else if (nutrientKey === 'carbs') {
        amount = nutrition.carbs || 0;
      }

      if (amount > 0) {
        foods.push({
          foodName: food.name || 'Unknown food',
          amount,
        });
        total += amount;
      }
    });
  });

  const breakdown = foods
    .map((f) => ({
      ...f,
      percentage: total > 0 ? (f.amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return { breakdown, total };
};

export default NutritionCarousel;
