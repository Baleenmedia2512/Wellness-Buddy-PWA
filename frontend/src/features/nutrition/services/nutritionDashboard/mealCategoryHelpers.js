const formatTimeAMPM = (hour, minute = 0) => {
  const d = new Date();
  d.setHours(hour);
  d.setMinutes(minute);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const CATEGORIES = {
  breakfast: {
    name: 'Breakfast',
    timeRange: { start: { h: 5, m: 0 }, end: { h: 10, m: 0 } },
  },
  'morning-snack': {
    name: 'Morning Snack',
    timeRange: { start: { h: 10, m: 0 }, end: { h: 12, m: 0 } },
  },
  lunch: {
    name: 'Lunch',
    timeRange: { start: { h: 12, m: 0 }, end: { h: 16, m: 0 } },
  },
  'evening-snack': {
    name: 'Evening Snack',
    timeRange: { start: { h: 16, m: 0 }, end: { h: 18, m: 0 } },
  },
  dinner: {
    name: 'Dinner',
    timeRange: { start: { h: 18, m: 0 }, end: { h: 23, m: 0 } },
  },
  'late-night': {
    name: 'Late Night',
    timeRange: { start: { h: 23, m: 0 }, end: { h: 5, m: 0 } },
  },
};

export function getMealCategoryInfo(category) {
  return CATEGORIES[category] || CATEGORIES['late-night'];
}

export function formatTimeRangeAMPM(range) {
  return range
    ? `${formatTimeAMPM(range.start.h, range.start.m)} - ${formatTimeAMPM(range.end.h, range.end.m)}`
    : '';
}

export const MEAL_CATEGORY_ORDER = [
  'breakfast',
  'morning-snack',
  'lunch',
  'evening-snack',
  'dinner',
  'late-night',
];
