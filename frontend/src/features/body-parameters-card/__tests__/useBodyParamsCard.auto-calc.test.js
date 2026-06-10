/**
 * useBodyParamsCard.auto-calc.test.js
 * Tests for the 3 auto-calculation derivations in useBodyParamsCard.
 * Uses renderHook from @testing-library/react.
 */
import { act, renderHook } from '@testing-library/react';
import { useBodyParamsCard } from '../hooks/useBodyParamsCard.js';

describe('derivedIdealWeight', () => {
  it('returns null when height is empty', () => {
    const { result } = renderHook(() => useBodyParamsCard({}));
    expect(result.current.derivedIdealWeight).toBeNull();
  });

  it('computes BMI-23 ideal weight from height 170', () => {
    const { result } = renderHook(() => useBodyParamsCard({}));
    act(() => result.current.setField('heightCm', '170'));
    // 23 × (1.70)² = 66.47 → rounded to 66.5
    expect(result.current.derivedIdealWeight).toBeCloseTo(66.5, 0);
  });

  it('returns null for height below 50 cm', () => {
    const { result } = renderHook(() => useBodyParamsCard({}));
    act(() => result.current.setField('heightCm', '30'));
    expect(result.current.derivedIdealWeight).toBeNull();
  });
});

describe('weight auto-fill removed', () => {
  it('does NOT auto-fill weight when height is entered', () => {
    const { result } = renderHook(() => useBodyParamsCard({}));
    act(() => result.current.setField('heightCm', '170'));
    // Weight must stay blank — auto-fill was intentionally removed.
    expect(result.current.form.weightKg).toBe('');
  });
});

describe('derivedBmi', () => {
  it('returns null when height or weight is missing', () => {
    const { result } = renderHook(() => useBodyParamsCard({}));
    expect(result.current.derivedBmi).toBeNull();
  });

  it('computes BMI from height 170 and weight 66', () => {
    const { result } = renderHook(() => useBodyParamsCard({}));
    act(() => result.current.setField('heightCm', '170'));
    act(() => result.current.setWeightManually('66'));
    // 66 / (1.70)² = 22.84 → rounded to 22.8
    expect(result.current.derivedBmi).toBeCloseTo(22.8, 0);
  });
});

describe('BMI auto-fill', () => {
  it('auto-fills BMI when height and weight are both set', () => {
    const { result } = renderHook(() => useBodyParamsCard({}));
    act(() => result.current.setField('heightCm', '170'));
    act(() => result.current.setWeightManually('66'));
    expect(parseFloat(result.current.form.bmi)).toBeCloseTo(22.8, 0);
  });

  it('does NOT auto-fill BMI when user has manually typed it', () => {
    const { result } = renderHook(() => useBodyParamsCard({}));
    act(() => result.current.setBmiManually('20'));
    act(() => result.current.setField('heightCm', '170'));
    act(() => result.current.setWeightManually('66'));
    expect(result.current.form.bmi).toBe('20');
  });
});

describe('fatHint', () => {
  it('shows generic hint when no gender selected', () => {
    const { result } = renderHook(() => useBodyParamsCard({}));
    expect(result.current.fatHint).toBe('Male: 10–20 / Female: 20–30');
  });

  it('shows male range for Male', () => {
    const { result } = renderHook(() => useBodyParamsCard({}));
    act(() => result.current.setField('gender', 'Male'));
    expect(result.current.fatHint).toBe('Healthy range: 10–20%');
  });

  it('shows female range for Female', () => {
    const { result } = renderHook(() => useBodyParamsCard({}));
    act(() => result.current.setField('gender', 'Female'));
    expect(result.current.fatHint).toBe('Healthy range: 20–30%');
  });
});

describe('fatPlaceholder', () => {
  it('returns % when no gender selected', () => {
    const { result } = renderHook(() => useBodyParamsCard({}));
    expect(result.current.fatPlaceholder).toBe('%');
  });

  it('returns 10–20% for Male', () => {
    const { result } = renderHook(() => useBodyParamsCard({}));
    act(() => result.current.setField('gender', 'Male'));
    expect(result.current.fatPlaceholder).toBe('10–20%');
  });

  it('returns 20–30% for Female', () => {
    const { result } = renderHook(() => useBodyParamsCard({}));
    act(() => result.current.setField('gender', 'Female'));
    expect(result.current.fatPlaceholder).toBe('20–30%');
  });
});
