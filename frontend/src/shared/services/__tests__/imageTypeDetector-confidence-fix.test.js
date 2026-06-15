/**
 * Test: Confidence normalization fix for PR #XXX
 * Bug: Gemini returns confidence as string ("high", "medium", "low")
 *      instead of numeric (0.0-1.0), causing isLowConfidenceFood() to
 *      incorrectly treat successful detections as "unknown".
 */

import { ImageTypeDetector } from '../imageTypeDetector';

describe('ImageTypeDetector - Confidence Normalization', () => {
  let detector;

  beforeAll(() => {
    detector = new ImageTypeDetector();
  });

  describe('normalizeConfidence', () => {
    test('converts "high" string to 0.9', () => {
      expect(detector.normalizeConfidence('high')).toBe(0.9);
    });

    test('converts "medium" string to 0.6', () => {
      expect(detector.normalizeConfidence('medium')).toBe(0.6);
    });

    test('converts "low" string to 0.3', () => {
      expect(detector.normalizeConfidence('low')).toBe(0.3);
    });

    test('handles case-insensitive strings', () => {
      expect(detector.normalizeConfidence('HIGH')).toBe(0.9);
      expect(detector.normalizeConfidence('Medium')).toBe(0.6);
      expect(detector.normalizeConfidence(' low ')).toBe(0.3);
    });

    test('returns valid numeric confidence as-is', () => {
      expect(detector.normalizeConfidence(0.85)).toBe(0.85);
      expect(detector.normalizeConfidence(0.5)).toBe(0.5);
      expect(detector.normalizeConfidence(0.2)).toBe(0.2);
      expect(detector.normalizeConfidence(1.0)).toBe(1.0);
      expect(detector.normalizeConfidence(0.0)).toBe(0.0);
    });

    test('parses numeric strings', () => {
      expect(detector.normalizeConfidence('0.85')).toBe(0.85);
      expect(detector.normalizeConfidence('0.5')).toBe(0.5);
    });

    test('defaults to 0.6 for invalid values', () => {
      expect(detector.normalizeConfidence(undefined)).toBe(0.6);
      expect(detector.normalizeConfidence(null)).toBe(0.6);
      expect(detector.normalizeConfidence('invalid')).toBe(0.6);
      expect(detector.normalizeConfidence(-1)).toBe(0.6);
      expect(detector.normalizeConfidence(1.5)).toBe(0.6);
    });
  });

  describe('Bug reproduction - Dosa + Sambar example', () => {
    test('string "high" confidence should be >= 0.4 threshold', () => {
      // Simulate the bug: Gemini returns confidence: "high" (string)
      const geminiResponse = {
        type: 'food',
        confidence: 'high',  // ← This was causing the bug
        foods: [
          { name: 'Dosa', nutrition: { calories: 297 } },
          { name: 'Sambar', nutrition: { calories: 125 } }
        ],
        total: { calories: 422 }
      };

      // Normalize confidence
      const normalized = detector.normalizeConfidence(geminiResponse.confidence);

      // Should convert to 0.9, which is above the 0.4 threshold
      expect(normalized).toBe(0.9);
      expect(normalized).toBeGreaterThanOrEqual(0.4);
    });
  });
});
