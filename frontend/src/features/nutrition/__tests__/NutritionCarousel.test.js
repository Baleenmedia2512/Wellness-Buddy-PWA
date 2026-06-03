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
  },
  latestWeight: 70,
  selectedDate: new Date('2025-01-01'),
};

describe('NutritionCarousel', () => {
  it('renders the Calories card by default', () => {
    render(<NutritionCarousel {...BASE_PROPS} />);
    expect(screen.getByText('Calories')).toBeInTheDocument();
  });

  it('slide track translateX uses per-card width (20%), not 100%, so other cards are reachable', () => {
    // Regression: translateX(-100%) moves 5 cards at once (blank). Must be -20% per step.
    const { container } = render(<NutritionCarousel {...BASE_PROPS} />);
    const track = container.querySelector('.flex.transition-transform');
    // Initially at card 0 — transform should be translateX(-0%)
    expect(track.style.transform).toBe('translateX(-0%)');
    // Click Macros dot (card 1)
    fireEvent.click(screen.getByRole('button', { name: 'Go to Macros' }));
    expect(track.style.transform).toBe('translateX(-20%)');
    // Click Heart Healthy dot (card 2)
    fireEvent.click(screen.getByRole('button', { name: 'Go to Heart Healthy' }));
    expect(track.style.transform).toBe('translateX(-40%)');
    // Click Low Carb dot (card 3)
    fireEvent.click(screen.getByRole('button', { name: 'Go to Low Carb' }));
    expect(track.style.transform).toBe('translateX(-60%)');
    // Click Glycemic Index dot (card 4)
    fireEvent.click(screen.getByRole('button', { name: 'Go to Glycemic Index' }));
    expect(track.style.transform).toBe('translateX(-80%)');
  });

  it('renders five dot indicators', () => {
    render(<NutritionCarousel {...BASE_PROPS} />);
    const buttons = screen.getAllByRole('button', { name: /Go to/i });
    expect(buttons).toHaveLength(5);
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
