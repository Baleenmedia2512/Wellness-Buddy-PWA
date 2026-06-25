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
      <CaloriesCard key="calories" {...calCard} onOpenModal={handleOpenModal} />,
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
      <HeartHealthyCard key="heart"   fat={heartCard.fat} sodium={heartCard.sodium} cholesterol={heartCard.cholesterol} onOpenModal={handleOpenModal} />,
      <LowCarbCard      key="lowcarb" carbs={lowCarbCard.carbs} sugar={lowCarbCard.sugar} fiber={lowCarbCard.fiber} onOpenModal={handleOpenModal} />,
      <GICard           key="gi"      averageGI={giCard.averageGI} mealCount={giCard.mealCount} />,
      <VitaminsFatSolubleCard key="vit-fat" tiles={vitFatTiles} onOpenModal={handleOpenModal} />,
      <VitaminsBComplexCard   key="vit-b"   tiles={vitBTiles} onOpenModal={handleOpenModal} />,
      <MineralsCard           key="minerals" tiles={mineralTiles} onOpenModal={handleOpenModal} />,
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
        nutrientName={getNutrientDisplayName(modalState.nutrient)}
        unit={getNutrientUnit(modalState.nutrient)}
        totalConsumed={getNutrientTotal(modalState.nutrient, dailyStats, calCard, proteinTarget, fatTarget, carbsTarget, heartCard, lowCarbCard)}
        target={getNutrientTarget(modalState.nutrient, proteinTarget, fatTarget, carbsTarget, calCard.target, heartCard, lowCarbCard)}
        foodBreakdown={
          modalState.isOpen && modalState.nutrient ? extractFoodContributions(analyses, modalState.nutrient).breakdown : []
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
 * Supports: macros, micros, calories, sodium, cholesterol, sugar, fiber, vitamins, minerals
 */
const extractFoodContributions = (analyses, nutrientKey) => {
  const foods = [];
  let total = 0;

  // Strip "total" prefix if present (e.g., totalVitaminA -> vitaminA)
  const normalizedKey = nutrientKey.startsWith('total') 
    ? nutrientKey.charAt(5).toLowerCase() + nutrientKey.slice(6) 
    : nutrientKey;

  analyses.forEach((analysis) => {
    if (analysis.isUndoPlaceholder) return;
    const data = parseAnalysisData(analysis.AnalysisData);
    const foodList = data.foods || [];

    foodList.forEach((food) => {
      const nutrition = food.nutrition || {};
      let amount = 0;

      // Macros
      if (normalizedKey === 'protein') amount = nutrition.protein || 0;
      else if (normalizedKey === 'fat') amount = nutrition.fat || 0;
      else if (normalizedKey === 'carbs') amount = nutrition.carbs || 0;
      
      // Calories
      else if (normalizedKey === 'calories') amount = nutrition.calories || 0;
      
      // Heart Health
      else if (normalizedKey === 'sodium') amount = nutrition.sodium || 0;
      else if (normalizedKey === 'cholesterol') amount = nutrition.cholesterol || 0;
      
      // Low Carb
      else if (normalizedKey === 'sugar') amount = nutrition.sugar || 0;
      else if (normalizedKey === 'fiber') amount = nutrition.fiber || 0;
      
      // Fat-Soluble Vitamins (in mcg or IU)
      else if (normalizedKey === 'vitaminA') amount = nutrition.vitaminA || 0;
      else if (normalizedKey === 'vitaminC') amount = nutrition.vitaminC || 0;
      else if (normalizedKey === 'vitaminD') amount = nutrition.vitaminD || 0;
      else if (normalizedKey === 'vitaminE') amount = nutrition.vitaminE || 0;
      else if (normalizedKey === 'vitaminK') amount = nutrition.vitaminK || 0;
      
      // B Vitamins (in mg or mcg)
      else if (normalizedKey === 'vitaminB1' || normalizedKey === 'thiamin') amount = nutrition.vitaminB1 || nutrition.thiamin || 0;
      else if (normalizedKey === 'vitaminB2' || normalizedKey === 'riboflavin') amount = nutrition.vitaminB2 || nutrition.riboflavin || 0;
      else if (normalizedKey === 'vitaminB3' || normalizedKey === 'niacin') amount = nutrition.vitaminB3 || nutrition.niacin || 0;
      else if (normalizedKey === 'vitaminB6') amount = nutrition.vitaminB6 || 0;
      else if (normalizedKey === 'vitaminB9' || normalizedKey === 'folate') amount = nutrition.vitaminB9 || nutrition.folate || 0;
      else if (normalizedKey === 'vitaminB12') amount = nutrition.vitaminB12 || 0;
      
      // Minerals (in mg or mcg)
      else if (normalizedKey === 'calcium') amount = nutrition.calcium || 0;
      else if (normalizedKey === 'iron') amount = nutrition.iron || 0;
      else if (normalizedKey === 'magnesium') amount = nutrition.magnesium || 0;
      else if (normalizedKey === 'potassium') amount = nutrition.potassium || 0;
      else if (normalizedKey === 'zinc') amount = nutrition.zinc || 0;
      else if (normalizedKey === 'phosphorus') amount = nutrition.phosphorus || 0;

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

// Helper functions for modal data
const getNutrientDisplayName = (nutrient) => {
  // Strip "total" prefix if present
  const key = nutrient?.startsWith('total') ? nutrient.slice(5) : nutrient;
  
  const names = {
    protein: 'Protein', fat: 'Fat', carbs: 'Carbs', calories: 'Calories',
    sodium: 'Sodium', cholesterol: 'Cholesterol', sugar: 'Sugar', fiber: 'Fiber',
    VitaminA: 'Vitamin A', VitaminC: 'Vitamin C', VitaminD: 'Vitamin D',
    VitaminE: 'Vitamin E', VitaminK: 'Vitamin K',
    VitaminB1: 'Vitamin B1', VitaminB2: 'Vitamin B2', VitaminB3: 'Vitamin B3',
    VitaminB6: 'Vitamin B6', VitaminB9: 'Vitamin B9', VitaminB12: 'Vitamin B12',
    Calcium: 'Calcium', Iron: 'Iron', Magnesium: 'Magnesium',
    Potassium: 'Potassium', Zinc: 'Zinc', Phosphorus: 'Phosphorus',
  };
  return names[key] || '';
};

const getNutrientUnit = (nutrient) => {
  // Strip "total" prefix if present
  const key = nutrient?.startsWith('total') ? nutrient.slice(5).toLowerCase() : nutrient;
  
  if (['protein', 'fat', 'carbs', 'sugar', 'fiber'].includes(key)) return 'g';
  if (['sodium', 'cholesterol', 'calcium', 'magnesium', 'potassium', 'phosphorus', 'vitaminc', 'vitaminb1', 'vitaminb2', 'vitaminb3', 'vitaminb6', 'iron'].includes(key)) return 'mg';
  if (['vitamina', 'vitamind', 'vitamine', 'vitamink', 'vitaminb9', 'vitaminb12', 'zinc'].includes(key)) return 'µg';
  if (key === 'calories') return 'kcal';
  return '';
};

const getNutrientTotal = (nutrient, dailyStats, calCard, proteinTarget, fatTarget, carbsTarget, heartCard, lowCarbCard) => {
  // Strip "total" prefix and normalize to lowercase
  const key = nutrient?.startsWith('total') ? nutrient.slice(5).toLowerCase() : nutrient?.toLowerCase();
  
  if (key === 'protein') return dailyStats?.totalProtein || 0;
  if (key === 'fat') return dailyStats?.totalFat || 0;
  if (key === 'carbs') return dailyStats?.totalCarbs || 0;
  if (key === 'calories') return calCard?.consumed || 0;
  if (key === 'sodium') return heartCard?.sodium?.consumed || 0;
  if (key === 'cholesterol') return heartCard?.cholesterol?.consumed || 0;
  if (key === 'sugar') return lowCarbCard?.sugar?.consumed || 0;
  if (key === 'fiber') return lowCarbCard?.fiber?.consumed || 0;
  // Vitamins and minerals - dailyStats uses "total" prefix
  if (key === 'vitamina') return dailyStats?.totalVitaminA || 0;
  if (key === 'vitaminc') return dailyStats?.totalVitaminC || 0;
  if (key === 'vitamind') return dailyStats?.totalVitaminD || 0;
  if (key === 'vitamine') return dailyStats?.totalVitaminE || 0;
  if (key === 'vitamink') return dailyStats?.totalVitaminK || 0;
  if (key === 'vitaminb1') return dailyStats?.totalVitaminB1 || 0;
  if (key === 'vitaminb2') return dailyStats?.totalVitaminB2 || 0;
  if (key === 'vitaminb3') return dailyStats?.totalVitaminB3 || 0;
  if (key === 'vitaminb6') return dailyStats?.totalVitaminB6 || 0;
  if (key === 'vitaminb9') return dailyStats?.totalVitaminB9 || 0;
  if (key === 'vitaminb12') return dailyStats?.totalVitaminB12 || 0;
  if (key === 'calcium') return dailyStats?.totalCalcium || 0;
  if (key === 'iron') return dailyStats?.totalIron || 0;
  if (key === 'magnesium') return dailyStats?.totalMagnesium || 0;
  if (key === 'potassium') return dailyStats?.totalPotassium || 0;
  if (key === 'zinc') return dailyStats?.totalZinc || 0;
  if (key === 'phosphorus') return dailyStats?.totalPhosphorus || 0;
  return 0;
};

const getNutrientTarget = (nutrient, proteinTarget, fatTarget, carbsTarget, calorieTarget, heartCard, lowCarbCard) => {
  // Strip "total" prefix and normalize to lowercase
  const key = nutrient?.startsWith('total') ? nutrient.slice(5).toLowerCase() : nutrient?.toLowerCase();
  
  if (key === 'protein') return proteinTarget || 0;
  if (key === 'fat') return fatTarget || 0;
  if (key === 'carbs') return carbsTarget || 0;
  if (key === 'calories') return calorieTarget || 0;
  if (key === 'sodium') return heartCard?.sodium?.target || 2300;
  if (key === 'cholesterol') return heartCard?.cholesterol?.target || 300;
  if (key === 'sugar') return lowCarbCard?.sugar?.target || 50;
  if (key === 'fiber') return lowCarbCard?.fiber?.target || 25;
  // RDA targets for vitamins/minerals (from micronutrientRules.js)
  if (key === 'vitamina') return 900;
  if (key === 'vitaminc') return 90;
  if (key === 'vitamind') return 20;
  if (key === 'vitamine') return 15;
  if (key === 'vitamink') return 120;
  if (key === 'vitaminb1') return 1.2;
  if (key === 'vitaminb2') return 1.3;
  if (key === 'vitaminb3') return 16;
  if (key === 'vitaminb6') return 1.7;
  if (key === 'vitaminb9') return 400;
  if (key === 'vitaminb12') return 2.4;
  if (key === 'calcium') return 1000;
  if (key === 'iron') return 18;
  if (key === 'magnesium') return 420;
  if (key === 'potassium') return 3500;
  if (key === 'zinc') return 11;
  if (key === 'phosphorus') return 700;
  return 0;
};

export default NutritionCarousel;
