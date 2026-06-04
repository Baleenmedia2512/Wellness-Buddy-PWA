/**
 * Unit tests for background-analysis service — TotalSugar / TotalSodium / TotalCholesterol.
 *
 * Regression suite for migration 0009 which added the three micronutrient
 * columns to food_nutrition_data_table.
 *
 * Root cause (fixed in transformAnalysisFormat.js):
 *   macros() only copied 5 fields; sugar/sodium/cholesterol were silently
 *   dropped before the payload reached this service → NULL DB writes.
 *
 * This file tests:
 *   1. save() — extractNutrition correctly reads all three fields from every
 *      supported analysis shape and passes them to repo.insertAnalysis.
 *   2. getPublicCapture() — the API response exposes all three fields so the
 *      public share view can display Heart-Healthy and Low-Carb metrics.
 *
 * Coverage target: ≥ 95 % lines / 90 % branches (claude.md §9.1).
 */

import { save, getPublicCapture } from '../analysis.service.js';

// ─── mock repository ─────────────────────────────────────────────────────────

jest.mock('../analysis.repository.js', () => ({
  findFoodByCaptureId: jest.fn(),
  insertAnalysis: jest.fn(),
  updateWithAnalysisResult: jest.fn(),
  listAnalyses: jest.fn(),
  softDeleteAnalysis: jest.fn(),
  checkOwnership: jest.fn(),
  restoreAnalysis: jest.fn(),
  touchLastActive: jest.fn(),
  findPublicByToken: jest.fn(),
  findOwnerByToken: jest.fn(),
  getCoachChain: jest.fn(),
  findUserName: jest.fn(),
  isCoCoachPaired: jest.fn(),
  getISTTimestamp: () => '2026-06-02T10:00:00.000Z',
  convertToIST: (ts) => ({ istTimestamp: ts }),
}));

jest.mock('../../captures/captures.service.js', () => ({
  recordPending:  jest.fn().mockResolvedValue({ id: 1001, publicShareToken: 'mock-token' }),
  updateType:     jest.fn().mockResolvedValue({ changed: true, imageType: 'food' }),
  updateTypeById: jest.fn().mockResolvedValue({ changed: true, imageType: 'food' }),
}));

import * as repo from '../analysis.repository.js';
import * as captures from '../../captures/captures.service.js';

// ─── shared fixture ───────────────────────────────────────────────────────────

const BASE_INPUT = {
  userId: '42',
  imagePath: 'photo.jpg',
  deviceInfo: 'Wellness Valley Web App',
  ImageBase64: null,
};

// ─── save — extractNutrition for sugar / sodium / cholesterol ─────────────────

describe('save — TotalSugar / TotalSodium / TotalCholesterol extraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repo.insertAnalysis.mockResolvedValue({ ID: 1 });
    repo.findFoodByCaptureId.mockResolvedValue(null);
    captures.updateTypeById.mockResolvedValue({ changed: true, imageType: 'food' });
    repo.touchLastActive.mockResolvedValue();
  });

  it('reads sugar/sodium/cholesterol from { foods, total } format (background-service shape)', async () => {
    const analysisResult = {
      foods: [{ name: 'Chicken', nutrition: { calories: 250, protein: 30, carbs: 0, fat: 5, fiber: 0, sugar: 0, sodium: 320, cholesterol: 85 } }],
      total: { calories: 250, protein: 30, carbs: 0, fat: 5, fiber: 0, sugar: 2, sodium: 680, cholesterol: 45 },
      confidence: 'high',
    };
    await save({ ...BASE_INPUT, analysisResult });
    const payload = repo.insertAnalysis.mock.calls[0][0];
    expect(payload.TotalSugar).toBe(2);
    expect(payload.TotalSodium).toBe(680);
    expect(payload.TotalCholesterol).toBe(45);
  });

  it('saves 0 (not null) when sugar/sodium/cholesterol are explicitly zero', async () => {
    const analysisResult = {
      foods: [{ name: 'Water', nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0 } }],
      total: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0 },
      confidence: 'high',
    };
    await save({ ...BASE_INPUT, analysisResult });
    const payload = repo.insertAnalysis.mock.calls[0][0];
    expect(payload.TotalSugar).toBe(0);
    expect(payload.TotalSodium).toBe(0);
    expect(payload.TotalCholesterol).toBe(0);
  });

  it('falls back to firstFood.nutrition when total is absent', async () => {
    const analysisResult = {
      foods: [{ name: 'Apple', nutrition: { calories: 95, protein: 0, carbs: 25, fat: 0, fiber: 4, sugar: 19, sodium: 2, cholesterol: 0 } }],
      confidence: 'medium',
    };
    await save({ ...BASE_INPUT, analysisResult });
    const payload = repo.insertAnalysis.mock.calls[0][0];
    expect(payload.TotalSugar).toBe(19);
    expect(payload.TotalSodium).toBe(2);
    expect(payload.TotalCholesterol).toBe(0);
  });

  it('reads sugar/sodium/cholesterol from { nutrition } format (legacy / manual-save shape)', async () => {
    const analysisResult = {
      nutrition: { calories: 400, protein: 15, carbs: 50, fat: 12, fiber: 5, sugar: 8, sodium: 450, cholesterol: 30 },
      confidence: 'medium',
    };
    await save({ ...BASE_INPUT, analysisResult });
    const payload = repo.insertAnalysis.mock.calls[0][0];
    expect(payload.TotalSugar).toBe(8);
    expect(payload.TotalSodium).toBe(450);
    expect(payload.TotalCholesterol).toBe(30);
  });

  it('saves null (not 0) when fields are absent from total — regression guard for pre-fix payloads', async () => {
    // Simulates data sent before the frontend fix was deployed.
    // undefined != null is false (loose equality) so the service must write
    // null, not 0, for these legacy records.
    const analysisResult = {
      foods: [{ name: 'Rice', nutrition: { calories: 200, protein: 4, carbs: 44, fat: 0, fiber: 1 } }],
      total: { calories: 200, protein: 4, carbs: 44, fat: 0, fiber: 1 },
      confidence: 'high',
    };
    await save({ ...BASE_INPUT, analysisResult });
    const payload = repo.insertAnalysis.mock.calls[0][0];
    expect(payload.TotalSugar).toBeNull();
    expect(payload.TotalSodium).toBeNull();
    expect(payload.TotalCholesterol).toBeNull();
  });
});

// ─── save — vitamin + mineral micronutrients (migration 0011) ─────────────────

describe('save — vitamin / mineral micronutrient extraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repo.insertAnalysis.mockResolvedValue({ ID: 1 });
    repo.findFoodByCaptureId.mockResolvedValue(null);
    captures.updateTypeById.mockResolvedValue({ changed: true, imageType: 'food' });
    repo.touchLastActive.mockResolvedValue();
  });

  it('reads all 17 micronutrients from { foods, total } shape', async () => {
    const analysisResult = {
      foods: [{ name: 'Spinach salad', nutrition: { calories: 100, protein: 3, carbs: 10, fat: 5, fiber: 4 } }],
      total: {
        calories: 100, protein: 3, carbs: 10, fat: 5, fiber: 4,
        sugar: 2, sodium: 80, cholesterol: 0, glycemic_index: 15,
        vitamin_a: 469, vitamin_c: 28, vitamin_d: 0, vitamin_e: 2, vitamin_k: 483,
        vitamin_b1: 0.08, vitamin_b2: 0.2, vitamin_b3: 0.7, vitamin_b6: 0.2,
        vitamin_b9: 194, vitamin_b12: 0,
        calcium: 99, iron: 2.7, magnesium: 79, potassium: 558, zinc: 0.5, phosphorus: 49,
      },
      confidence: 'high',
    };
    await save({ ...BASE_INPUT, analysisResult });
    const payload = repo.insertAnalysis.mock.calls[0][0];
    expect(payload.TotalVitaminA).toBe(469);
    expect(payload.TotalVitaminC).toBe(28);
    expect(payload.TotalVitaminB9).toBe(194);
    expect(payload.TotalVitaminB12).toBe(0);
    expect(payload.TotalCalcium).toBe(99);
    expect(payload.TotalPotassium).toBe(558);
    expect(payload.TotalPhosphorus).toBe(49);
  });

  it('writes null for absent micronutrient fields (legacy / pre-prompt payloads)', async () => {
    const analysisResult = {
      foods: [{ name: 'Rice', nutrition: { calories: 200, protein: 4, carbs: 44, fat: 0, fiber: 1 } }],
      total: { calories: 200, protein: 4, carbs: 44, fat: 0, fiber: 1 },
      confidence: 'high',
    };
    await save({ ...BASE_INPUT, analysisResult });
    const payload = repo.insertAnalysis.mock.calls[0][0];
    expect(payload.TotalVitaminA).toBeNull();
    expect(payload.TotalCalcium).toBeNull();
    expect(payload.TotalZinc).toBeNull();
  });

  it('reads micronutrients from { nutrition } legacy shape', async () => {
    const analysisResult = {
      nutrition: {
        calories: 250, protein: 12, carbs: 30, fat: 8, fiber: 3,
        calcium: 300, iron: 4, vitamin_d: 1.2,
      },
      confidence: 'medium',
    };
    await save({ ...BASE_INPUT, analysisResult });
    const payload = repo.insertAnalysis.mock.calls[0][0];
    expect(payload.TotalCalcium).toBe(300);
    expect(payload.TotalIron).toBe(4);
    expect(payload.TotalVitaminD).toBe(1.2);
    expect(payload.TotalVitaminA).toBeNull();
  });

  it('preserves explicit 0 (not null) for present-but-zero values', async () => {
    const analysisResult = {
      foods: [{ name: 'Oil', nutrition: { calories: 120, protein: 0, carbs: 0, fat: 14, fiber: 0 } }],
      total: {
        calories: 120, protein: 0, carbs: 0, fat: 14, fiber: 0,
        calcium: 0, iron: 0, magnesium: 0,
      },
      confidence: 'high',
    };
    await save({ ...BASE_INPUT, analysisResult });
    const payload = repo.insertAnalysis.mock.calls[0][0];
    expect(payload.TotalCalcium).toBe(0);
    expect(payload.TotalIron).toBe(0);
    expect(payload.TotalMagnesium).toBe(0);
  });
});

// ─── getPublicCapture — nutrition shape includes new fields ───────────────────

describe('getPublicCapture — sugar / sodium / cholesterol in nutrition response', () => {
  const VALID_TOKEN = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const FUTURE = new Date(Date.now() + 1e9).toISOString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes sugar/sodium/cholesterol in the nutrition object when DB row has values', async () => {
    repo.findPublicByToken.mockResolvedValue({
      ShareExpiresAt: FUTURE,
      AnalysisData: JSON.stringify({ foods: [{ name: 'Chicken' }], total: { calories: 300 } }),
      TotalCalories: 300,
      TotalProtein: 25,
      TotalCarbs: 5,
      TotalFat: 8,
      TotalFiber: 0,
      TotalSugar: 12,
      TotalSodium: 680,
      TotalCholesterol: 45,
      CreatedAt: FUTURE,
    });
    const r = await getPublicCapture({ token: VALID_TOKEN });
    expect(r.httpStatus).toBe(200);
    expect(r.body.data.nutrition.sugar).toBe(12);
    expect(r.body.data.nutrition.sodium).toBe(680);
    expect(r.body.data.nutrition.cholesterol).toBe(45);
  });

  it('returns null for sugar/sodium/cholesterol when DB row has NULL values (legacy rows)', async () => {
    repo.findPublicByToken.mockResolvedValue({
      ShareExpiresAt: FUTURE,
      AnalysisData: JSON.stringify({ foods: [], total: { calories: 150 } }),
      TotalCalories: 150,
      TotalProtein: 5,
      TotalCarbs: 20,
      TotalFat: 3,
      TotalFiber: 2,
      TotalSugar: null,
      TotalSodium: null,
      TotalCholesterol: null,
      CreatedAt: FUTURE,
    });
    const r = await getPublicCapture({ token: VALID_TOKEN });
    expect(r.httpStatus).toBe(200);
    expect(r.body.data.nutrition.sugar).toBeNull();
    expect(r.body.data.nutrition.sodium).toBeNull();
    expect(r.body.data.nutrition.cholesterol).toBeNull();
  });
});
