/**
 * NutritionCarousel — 5-card horizontal swipe carousel for the nutrition dashboard.
 *
 * Cards (in order):
 *   0 — Calories       (BMR target, consumed, exercise=0, remaining)
 *   1 — Macros         (protein/fat/carbs with weight-derived targets)
 *   2 — Heart Healthy  (fat, sodium ≤2300mg, cholesterol ≤300mg)
 *   3 — Low Carb       (carbs, sugar ≤50g, fiber ≥25g)
 *   4 — Glycemic Index (average GI with Low/Medium/High zones)
 *
 * Gesture: pointer-based swipe (≥36px), mirrors useSwipePanelHeight pattern.
 * Resets to card 0 when selectedDate changes.
 */
import React from 'react';
import {
  computeCaloriesCard,
  computeMacroTargets,
  computeHeartHealthyCard,
  computeLowCarbCard,
  computeGICard,
} from '../../domain/carouselRules';
import { useCarouselSwipe } from '../../hooks/useCarouselSwipe';
import CaloriesCard   from './carousel/CaloriesCard';
import MacrosCard     from './carousel/MacrosCard';
import HeartHealthyCard from './carousel/HeartHealthyCard';
import LowCarbCard    from './carousel/LowCarbCard';
import GICard         from './carousel/GICard';

const CARD_LABELS = ['Calories', 'Macros', 'Heart Health', 'Low Carb', 'Glycemic Index'];

const NutritionCarousel = ({
  calorieTarget,
  consumedCalories,
  burnedCalories,
  dailyStats,
  latestWeight,
  selectedDate,
}) => {
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

  const { activeIndex, goTo, swipeHandlers } = useCarouselSwipe({
    cardCount: CARD_LABELS.length,
    resetKey: selectedDate,
  });

  const allCards = [
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
    />,
    <HeartHealthyCard key="heart"   fat={heartCard.fat} sodium={heartCard.sodium} cholesterol={heartCard.cholesterol} />,
    <LowCarbCard      key="lowcarb" carbs={lowCarbCard.carbs} sugar={lowCarbCard.sugar} fiber={lowCarbCard.fiber} />,
    <GICard           key="gi"      averageGI={giCard.averageGI} mealCount={giCard.mealCount} />,
  ];

  const cards = allCards;

  return (
    <div className="px-2 md:px-3 mb-1.5">
      <div
        className="w-full max-w-md mx-auto bg-white/70 backdrop-blur-xl rounded-xl shadow-md border border-gray-100 overflow-hidden"
        {...swipeHandlers}
        style={{ touchAction: 'pan-y' }}
      >
        {/* Slide track */}
        <div
          className="flex transition-transform duration-400 ease-out"
          style={{ transform: `translateX(-${(activeIndex * 100) / cards.length}%)`, width: `${cards.length * 100}%` }}
        >
          {cards.map((card, i) => (
            <div key={i} style={{ width: `${100 / cards.length}%` }} className="min-h-[148px]">
              {card}
            </div>
          ))}
        </div>

        {/* Dot indicators + swipe hint */}
        <div className="flex items-center justify-center gap-1 pb-1.5 pt-0.5">
          <span className="text-[8px] text-gray-300 mr-0.5 select-none">‹</span>
          {CARD_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              aria-label={`Go to ${label}`}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? 'w-3 h-1 bg-emerald-400'
                  : 'w-1 h-1 bg-gray-200 hover:bg-gray-300'
              }`}
            />
          ))}
          <span className="text-[8px] text-gray-300 ml-0.5 select-none">›</span>
        </div>
      </div>
    </div>
  );
};

export default NutritionCarousel;
