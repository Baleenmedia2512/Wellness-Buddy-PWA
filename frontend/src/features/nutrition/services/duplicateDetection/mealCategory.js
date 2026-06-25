// Time-of-day → meal category mapping (used to detect "same meal" duplicates).

export const getMealCategory = (date = new Date()) => {
  const hour = date.getHours();
  if (hour >= 5 && hour < 10) return 'breakfast';
  if (hour >= 10 && hour < 12) return 'morning-snack';
  if (hour >= 12 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 18) return 'evening-snack';
  if (hour >= 18 && hour < 23) return 'dinner';
  return 'late-night';
};

const NAMES = {
  breakfast: 'Breakfast (5 AM - 10 AM)',
  'morning-snack': 'Morning Snack (10 AM - 12 PM)',
  lunch: 'Lunch (12 PM - 4 PM)',
  'evening-snack': 'Evening Snack (4 PM - 6 PM)',
  dinner: 'Dinner (6 PM - 11 PM)',
  'late-night': 'Late Night (11 PM - 5 AM)',
};

export const getMealCategoryName = (category) => NAMES[category] || category;
