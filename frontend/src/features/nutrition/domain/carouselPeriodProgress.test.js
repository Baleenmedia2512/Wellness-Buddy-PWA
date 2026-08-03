import {
  aggregateWellnessPeriodScore,
  getCarouselPeriodContext,
  sumDailyStatsForPeriod,
} from './carouselPeriodProgress';

describe('sumDailyStatsForPeriod', () => {
  it('sums totals across all days in the range', () => {
    const result = sumDailyStatsForPeriod([
      { mealCount: 2, totalCalories: 2000, totalProtein: 80, averageGlycemicIndex: 50, totalCarbs: 200 },
      { mealCount: 0, totalCalories: 0, totalProtein: 0, averageGlycemicIndex: null, totalCarbs: 0 },
      { mealCount: 1, totalCalories: 1800, totalProtein: 70, averageGlycemicIndex: 60, totalCarbs: 150 },
    ]);

    expect(result.totalCalories).toBe(3800);
    expect(result.totalProtein).toBe(150);
    expect(result.mealCount).toBe(3);
    expect(result.averageGlycemicIndex).toBe(54);
  });
});

describe('aggregateWellnessPeriodScore', () => {
  it('uses sum earned vs sum possible for period progress', () => {
    const result = aggregateWellnessPeriodScore([
      { totalEarned: 40, totalPossible: 80 },
      { totalEarned: 60, totalPossible: 80 },
    ]);

    expect(result.totalEarned).toBe(100);
    expect(result.totalPossible).toBe(160);
    expect(result.percentage).toBe(63);
    expect(result.dayCount).toBe(2);
  });
});

describe('getCarouselPeriodContext', () => {
  it('labels single-day vs period progress', () => {
    const single = getCarouselPeriodContext({
      preset: 'today',
      isMultiDay: false,
      dayCount: 1,
      loggedDayCount: 1,
      startDate: '2026-07-15',
      endDate: '2026-07-15',
      today: '2026-07-15',
    });
    expect(single.trackingLabel).toBe('Daily track');
    expect(single.goalScale).toBe(1);

    const range = getCarouselPeriodContext({
      preset: 'last7days',
      isMultiDay: true,
      dayCount: 7,
      loggedDayCount: 4,
      startDate: '2026-07-09',
      endDate: '2026-07-15',
      today: '2026-07-15',
    });
    expect(range.title).toBe('Last 7 days');
    expect(range.trackingLabel).toBe('Period progress');
    expect(range.goalScale).toBe(7);
    expect(range.progressHint).toBe('4 of 7 days with food logs');
  });
});
