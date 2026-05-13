// Pure date/device helpers used by NutritionDashboard.
// All functions are side-effect free; date generators receive selectedDate explicitly.

export const isMobileDevice = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  ) || window.innerWidth <= 768;

export const isSmallChartDevice = () =>
  typeof window !== "undefined" && window.innerWidth < 380;

/**
 * Build the 7-day strip (-3 .. +3) centred on selectedDate used by the
 * desktop date selector.
 */
export const generateHorizontalCalendarDates = (selectedDate) => {
  const dates = [];
  const today = new Date();
  for (let i = -3; i <= 3; i++) {
    const date = new Date(selectedDate);
    date.setDate(selectedDate.getDate() + i);
    const prevDate = i > -3 ? new Date(selectedDate) : null;
    if (prevDate) prevDate.setDate(selectedDate.getDate() + (i - 1));
    const isNewMonth =
      i === -3 || (prevDate && date.getMonth() !== prevDate.getMonth());
    dates.push({
      date,
      dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
      dayNumber: date.getDate(),
      monthName: date.toLocaleDateString("en-US", { month: "short" }),
      isToday: date.toDateString() === today.toDateString(),
      isSelected: date.toDateString() === selectedDate.toDateString(),
      isFuture: date > today,
      isNewMonth,
    });
  }
  return dates;
};

/**
 * Build the 21-day scrollable strip (today-20 .. today) used by the mobile
 * date selector. The "selected" flag is computed against selectedDate.
 */
export const generateScrollableDates = (selectedDate) => {
  const dates = [];
  const today = new Date();
  for (let i = -20; i <= 0; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const prevDate = i > -20 ? new Date(today) : null;
    if (prevDate) prevDate.setDate(today.getDate() + (i - 1));
    const isNewMonth =
      i === -20 || (prevDate && date.getMonth() !== prevDate.getMonth());
    dates.push({
      date,
      dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
      dayNumber: date.getDate(),
      monthName: date.toLocaleDateString("en-US", { month: "short" }),
      isToday: date.toDateString() === today.toDateString(),
      isSelected: date.toDateString() === selectedDate.toDateString(),
      isFuture: false,
      isNewMonth,
    });
  }
  return dates;
};
