// Pure helpers used across the nutrition dashboard.
// These do NOT touch the network — see *Api.js modules for fetches.
import React from 'react';

/** Treat API timestamps without trailing-Z as local time. */
export const istToLocalDate = (value) => {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'string') {
    const normalized = value.endsWith('Z') ? value.slice(0, -1) : value;
    const localDate = new Date(normalized);
    if (!Number.isNaN(localDate.getTime())) return localDate;
  }
  return new Date(value);
};

export const getMealCategory = (timeString) => {
  const hour = istToLocalDate(timeString).getHours();
  if (hour >= 5 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 12) return 'morning-snack';
  if (hour >= 12 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 18) return 'evening-snack';
  if (hour >= 18 && hour < 23) return 'dinner';
  return 'late-night';
};

export const toLocalDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatFoodsTitle = (foods, moreTextColor) => {
  const count = foods.length || 0;
  if (count === 0) return 'Unknown Food';
  const first = (foods[0]?.name || 'Unknown Food').trim();
  if (count === 1) return first;
  if (count === 2) {
    const second = (foods[1]?.name || 'another item').trim();
    return `${first} & ${second}`;
  }
  const others = count - 1;
  return (
    <>
      {first}{' '}
      <span className={`${moreTextColor} text-sm font-normal`}>
        + {others} more
      </span>
    </>
  );
};

/** Parse a meal's AnalysisData column into { name, nutrition, detailedItems }. */
export const parseAnalysisData = (analysisData, moreTextColor = 'text-gray-500') => {
  try {
    const parsed = typeof analysisData === 'string' ? JSON.parse(analysisData) : analysisData;
    if (parsed?.foods?.length > 0 && parsed?.total) {
      return {
        name: formatFoodsTitle(parsed.foods, moreTextColor),
        nutrition: {
          calories: parsed.total.calories || 0,
          protein:  parsed.total.protein  || 0,
          carbs:    parsed.total.carbs    || 0,
          fat:      parsed.total.fat      || 0,
          fiber:    parsed.total.fiber    || 0,
        },
        detailedItems: parsed.foods || [],
      };
    }
    if (parsed?.category?.name) {
      return { name: parsed.category.name, nutrition: parsed.nutrition || {}, detailedItems: parsed.detailedItems || [] };
    }
    if (parsed?.foods?.length > 0) {
      const firstFood = parsed.foods[0] || {};
      return { name: formatFoodsTitle(parsed.foods, moreTextColor), nutrition: firstFood.nutrition || {}, detailedItems: parsed.foods || [] };
    }
    return { name: 'Unknown Food', nutrition: {}, detailedItems: [] };
  } catch {
    return { name: 'Error parsing data', nutrition: {}, detailedItems: [] };
  }
};

/** Sum & round per-item nutrition into day/meal totals. */
export const recalculateTotals = (items) => {
  const t = items.reduce(
    (acc, item) => ({
      calories: acc.calories + (item.nutrition?.calories || item.calories || 0),
      protein:  acc.protein  + (item.nutrition?.protein  || item.protein  || 0),
      carbs:    acc.carbs    + (item.nutrition?.carbs    || item.carbs    || 0),
      fat:      acc.fat      + (item.nutrition?.fat      || item.fat      || 0),
      fiber:    acc.fiber    + (item.nutrition?.fiber    || item.fiber    || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
  return {
    calories: Math.round(t.calories),
    protein:  Math.round(t.protein * 10) / 10,
    carbs:    Math.round(t.carbs   * 10) / 10,
    fat:      Math.round(t.fat     * 10) / 10,
    fiber:    Math.round(t.fiber   * 10) / 10,
  };
};
