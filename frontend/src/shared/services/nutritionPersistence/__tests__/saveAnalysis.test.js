/**
 * saveAnalysis.test.js
 *
 * Verifies that saveNutritionAnalysis always forwards captureId to the
 * fetch body when provided, and omits it when not provided.
 *
 * Regression for: duplicate DB records when a fast Gemini response races
 * ahead of the /captures POST, leaving captureId null at save time.
 */
import { saveNutritionAnalysis } from '../saveAnalysis';

// Stub helpers that make external calls
jest.mock('../userIdLookup', () => ({
  resolveTeamUserId: jest.fn(async (id) => id),
}));
jest.mock('../demoMealStore', () => ({
  isDemoUser: jest.fn(() => false),
  saveDemoMeal: jest.fn(),
}));
jest.mock('../transformAnalysisFormat', () => ({
  transformToBackgroundServiceFormat: jest.fn((r) => r),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const BASE_ARGS = {
  userId: 'user-1',
  imagePath: 'photo.jpg',
  imageBase64: 'base64data',
  analysisResult: { foods: [] },
  deviceInfo: 'test',
  userEmail: 'test@example.com',
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.REACT_APP_API_BASE_URL = 'http://localhost:3000';
  mockFetch.mockResolvedValue({
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => ({ id: 42, insertId: 42 }),
  });
});

test('sends captureId in request body when provided', async () => {
  await saveNutritionAnalysis({ ...BASE_ARGS, captureId: 99 });

  const body = JSON.parse(mockFetch.mock.calls[0][1].body);
  expect(body.captureId).toBe(99);
});

test('omits captureId from request body when null', async () => {
  await saveNutritionAnalysis({ ...BASE_ARGS, captureId: null });

  const body = JSON.parse(mockFetch.mock.calls[0][1].body);
  expect(body).not.toHaveProperty('captureId');
});

test('omits captureId from request body when undefined', async () => {
  await saveNutritionAnalysis({ ...BASE_ARGS });

  const body = JSON.parse(mockFetch.mock.calls[0][1].body);
  expect(body).not.toHaveProperty('captureId');
});

test('returns response data on success', async () => {
  const result = await saveNutritionAnalysis({ ...BASE_ARGS, captureId: 7 });
  expect(result.id).toBe(42);
});
