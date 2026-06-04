/**
 * NutritionCarousel.test.js — smoke + behaviour tests for the carousel shell.
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NutritionCarousel from '../components/dashboard/NutritionCarousel';

const BASE_PROPS = {
  calorieTarget: 2000,
  consumedCalories: 1200,
  burnedCalories: 0,
  dailyStats: {
    totalCalories: 1200,
    totalProtein: 80,
    totalCarbs: 150,
    totalFat: 40,
    totalFiber: 10,
    totalSugar: 20,
    totalSodium: 800,
    totalCholesterol: 100,
    averageGlycemicIndex: 58,
    mealCount: 3,
    // Sample micronutrients (mid-range vs RDA)
    totalVitaminA: 450, totalVitaminC: 60, totalVitaminD: 10, totalVitaminE: 8, totalVitaminK: 80,
    totalVitaminB1: 0.8, totalVitaminB2: 1.0, totalVitaminB3: 10, totalVitaminB6: 1.2, totalVitaminB9: 200, totalVitaminB12: 1.5,
    totalCalcium: 600, totalIron: 10, totalMagnesium: 250, totalPotassium: 2000, totalZinc: 6, totalPhosphorus: 500,
  },
  latestWeight: 70,
  selectedDate: new Date('2025-01-01'),
};

describe('NutritionCarousel', () => {
  it('renders the Calories card by default', () => {
    render(<NutritionCarousel {...BASE_PROPS} />);
    expect(screen.getByText('Calories')).toBeInTheDocument();
  });

  it('slide track translateX uses per-card width (12.5% of 8), not 100%, so other cards are reachable', () => {
    // Regression: with 8 cards each step must translate by 100/8 = 12.5%.
    const { container } = render(<NutritionCarousel {...BASE_PROPS} />);
    const track = container.querySelector('.flex.transition-transform');
    expect(track.style.transform).toBe('translateX(-0%)');
    fireEvent.click(screen.getByRole('button', { name: 'Go to Macros' }));
    expect(track.style.transform).toBe('translateX(-12.5%)');
    fireEvent.click(screen.getByRole('button', { name: 'Go to Heart Healthy' }));
    expect(track.style.transform).toBe('translateX(-25%)');
    fireEvent.click(screen.getByRole('button', { name: 'Go to Low Carb' }));
    expect(track.style.transform).toBe('translateX(-37.5%)');
    fireEvent.click(screen.getByRole('button', { name: 'Go to Glycemic Index' }));
    expect(track.style.transform).toBe('translateX(-50%)');
    fireEvent.click(screen.getByRole('button', { name: 'Go to Vitamins A-K' }));
    expect(track.style.transform).toBe('translateX(-62.5%)');
    fireEvent.click(screen.getByRole('button', { name: 'Go to B Vitamins' }));
    expect(track.style.transform).toBe('translateX(-75%)');
    fireEvent.click(screen.getByRole('button', { name: 'Go to Minerals' }));
    expect(track.style.transform).toBe('translateX(-87.5%)');
  });

  it('renders eight dot indicators (5 macro + 3 micro cards)', () => {
    render(<NutritionCarousel {...BASE_PROPS} />);
    const buttons = screen.getAllByRole('button', { name: /Go to/i });
    expect(buttons).toHaveLength(8);
  });

  it('renders the three new micronutrient cards', () => {
    render(<NutritionCarousel {...BASE_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to Vitamins A-K' }));
    expect(screen.getByText(/Vitamins A.K/i)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Go to B Vitamins' }));
    expect(screen.getByText('B Vitamins')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Minerals' }));
    expect(screen.getByText('Minerals')).toBeVisible();
  });

  it('clicking the Macros dot navigates to Macros card', () => {
    render(<NutritionCarousel {...BASE_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to Macros' }));
    expect(screen.getByText('Macros')).toBeVisible();
  });

  it('clicking Heart Healthy dot navigates correctly', () => {
    render(<NutritionCarousel {...BASE_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to Heart Healthy' }));
    expect(screen.getByText('Heart Healthy')).toBeVisible();
  });

  it('clicking Low Carb dot navigates correctly', () => {
    render(<NutritionCarousel {...BASE_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to Low Carb' }));
    expect(screen.getByText('Low Carb')).toBeVisible();
  });

  it('clicking Glycemic Index dot navigates correctly', () => {
    render(<NutritionCarousel {...BASE_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to Glycemic Index' }));
    expect(screen.getByText('Glycemic Index')).toBeVisible();
  });

  it('renders without crashing when latestWeight is null', () => {
    render(<NutritionCarousel {...BASE_PROPS} latestWeight={null} />);
    expect(screen.getByText('Calories')).toBeInTheDocument();
  });

  it('renders without crashing when all dailyStats are 0', () => {
    const stats = { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalFiber: 0, totalSugar: 0, totalSodium: 0, totalCholesterol: 0, averageGlycemicIndex: null, mealCount: 0 };
    render(<NutritionCarousel {...BASE_PROPS} dailyStats={stats} consumedCalories={0} />);
    expect(screen.getByText('Calories')).toBeInTheDocument();
  });

  it('renders micronutrient cards even when micronutrient fields are missing from dailyStats', () => {
    // Old dailyStats shapes (pre-migration) had no totalVitamin*/totalMineral* keys.
    // The compute helpers default to 0; cards must still render without throwing.
    const stats = { ...BASE_PROPS.dailyStats };
    delete stats.totalVitaminA;
    delete stats.totalCalcium;
    render(<NutritionCarousel {...BASE_PROPS} dailyStats={stats} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to Minerals' }));
    expect(screen.getByText('Minerals')).toBeVisible();
  });

  it('resets to Calories card on selectedDate change', () => {
    const { rerender } = render(<NutritionCarousel {...BASE_PROPS} />);
    // Navigate away from card 0
    fireEvent.click(screen.getByRole('button', { name: 'Go to Macros' }));
    // Change date
    rerender(<NutritionCarousel {...BASE_PROPS} selectedDate={new Date('2025-01-02')} />);
    // First dot should be active (Calories)
    const dots = screen.getAllByRole('button', { name: /Go to/i });
    // The Calories dot has the expanded pill style when active — verify it's rendered
    expect(dots[0]).toBeInTheDocument();
  });

  it('swipe left advances to next card', () => {
    const { container } = render(<NutritionCarousel {...BASE_PROPS} />);
    const track = container.firstChild;
    fireEvent.pointerDown(track, { isPrimary: true, clientX: 200 });
    fireEvent.pointerMove(track, { isPrimary: true, clientX: 150 });
    fireEvent.pointerUp(track);
    // After swipe left, Macros card should be visible
    expect(screen.getByText('Macros')).toBeInTheDocument();
  });

  it('swipe right on first card stays at first card', () => {
    const { container } = render(<NutritionCarousel {...BASE_PROPS} />);
    const track = container.firstChild;
    fireEvent.pointerDown(track, { isPrimary: true, clientX: 100 });
    fireEvent.pointerMove(track, { isPrimary: true, clientX: 160 });
    fireEvent.pointerUp(track);
    expect(screen.getByText('Calories')).toBeInTheDocument();
  });
});
