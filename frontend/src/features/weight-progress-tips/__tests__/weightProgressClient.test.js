/**
 * weightProgressClient.test.js
 * Tests for weight progress tips API client.
 * 
 * Coverage: cache-control headers, error handling, response parsing.
 */

import { fetchWeightProgressCheck } from '../api/weightProgressClient.js';
import { getApiBaseUrl } from '../../../config/api.config.js';

// Mock the config module
jest.mock('../../../config/api.config.js', () => ({
  getApiBaseUrl: jest.fn(),
}));

describe('fetchWeightProgressCheck', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    getApiBaseUrl.mockReturnValue('http://localhost:3000');
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('cache-control headers', () => {
    it('should include Cache-Control: no-cache header to prevent stale CORS responses', async () => {
      // This test reproduces the bug: without cache-busting headers,
      // browsers can serve cached 304 responses with stale CORS headers
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          ok: true,
          data: { shouldShow: false },
        }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      await fetchWeightProgressCheck(339);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/weight-progress-tips/check?userId=339',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          }),
          cache: 'no-store',
        })
      );
    });

    it('should include cache: no-store to force fresh network request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          ok: true,
          data: { shouldShow: false },
        }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      await fetchWeightProgressCheck(339);

      const fetchOptions = global.fetch.mock.calls[0][1];
      expect(fetchOptions.cache).toBe('no-store');
    });
  });

  describe('successful requests', () => {
    it('should fetch weight progress check without currentWeightId', async () => {
      const mockData = {
        shouldShow: true,
        comparison: { /* ... */ },
        tips: ['tip1', 'tip2'],
        goalMode: 'lose_weight',
      };
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ ok: true, data: mockData }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      const result = await fetchWeightProgressCheck(339);

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/weight-progress-tips/check?userId=339',
        expect.any(Object)
      );
    });

    it('should include currentWeightId in query params when provided', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          ok: true,
          data: { shouldShow: false },
        }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      await fetchWeightProgressCheck(339, 12345);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/weight-progress-tips/check?userId=339&currentWeightId=12345',
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should throw when response is not ok (HTTP error)', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid userId' },
        }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      await expect(fetchWeightProgressCheck(339)).rejects.toThrow('Invalid userId');
    });

    it('should throw when API returns ok=false', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          ok: false,
          error: { code: 'NO_WEIGHT_DATA', message: 'Insufficient weight history' },
        }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      await expect(fetchWeightProgressCheck(339)).rejects.toThrow('Insufficient weight history');
    });

    it('should handle network failures', async () => {
      global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(fetchWeightProgressCheck(339)).rejects.toThrow('Failed to fetch');
    });

    it('should handle malformed error responses gracefully', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      };
      global.fetch.mockResolvedValue(mockResponse);

      await expect(fetchWeightProgressCheck(339)).rejects.toThrow('HTTP 500');
    });
  });

  describe('CORS edge cases', () => {
    it('should work when origin changes between requests (cache invalidation)', async () => {
      // Simulates the bug scenario: developer switches from port 3001 to 3000
      // With cache-busting headers, each request should be fresh
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          ok: true,
          data: { shouldShow: false },
        }),
      };
      global.fetch.mockResolvedValue(mockResponse);

      await fetchWeightProgressCheck(339);

      // Verify cache-busting headers are present
      const fetchOptions = global.fetch.mock.calls[0][1];
      expect(fetchOptions.cache).toBe('no-store');
      expect(fetchOptions.headers['Cache-Control']).toBe('no-cache');
      expect(fetchOptions.headers['Pragma']).toBe('no-cache');
    });
  });
});
