/**
 * Unit tests for shareCardCaptureKey.
 * Run: npx react-scripts test --watchAll=false --testPathPattern=shareCardCaptureKey
 */
import {
  getShareCardCaptureKey,
  canReuseShareCapture,
} from './shareCardCaptureKey';

describe('shareCardCaptureKey', () => {
  const base = {
    name: 'Ali',
    age: 30,
    heightCm: 170,
    weightKg: 70,
    bmi: 24.2,
    fatPercent: 18,
    locationName: 'Chromepet',
    recoveredHealthIssues: ['Diabetes', 'BP'],
  };

  test('same painted fields produce the same key', () => {
    const a = getShareCardCaptureKey({ ...base, weightKg: '70' });
    const b = getShareCardCaptureKey({ ...base, weightKg: 70 });
    expect(a).toBe(b);
  });

  test('issues order does not change the key', () => {
    const a = getShareCardCaptureKey({
      ...base,
      recoveredHealthIssues: ['BP', 'Diabetes'],
    });
    const b = getShareCardCaptureKey(base);
    expect(a).toBe(b);
  });

  test('previousCard changes layout key', () => {
    const alone = getShareCardCaptureKey(base, null);
    const withPrev = getShareCardCaptureKey(base, { id: 9, weightKg: 72 });
    expect(alone).not.toBe(withPrev);
  });

  test('canReuseShareCapture requires exact key match', () => {
    const key = getShareCardCaptureKey(base);
    expect(canReuseShareCapture(key, base, null)).toBe(true);
    expect(canReuseShareCapture(key, { ...base, weightKg: 71 }, null)).toBe(false);
  });

  test('createdAt within the same minute reuses capture', () => {
    const a = getShareCardCaptureKey({
      ...base,
      createdAt: '2026-09-12T08:14:10.000Z',
    });
    const b = getShareCardCaptureKey({
      ...base,
      createdAt: '2026-09-12T08:14:55.000Z',
    });
    expect(a).toBe(b);
  });

  test('createdAt in a different minute changes the key', () => {
    const a = getShareCardCaptureKey({
      ...base,
      createdAt: '2026-09-12T08:14:10.000Z',
    });
    const b = getShareCardCaptureKey({
      ...base,
      createdAt: '2026-09-12T08:15:01.000Z',
    });
    expect(a).not.toBe(b);
  });

  test('different viewer timezones produce different keys', () => {
    const india = getShareCardCaptureKey(base, null, 'Asia/Kolkata');
    const usa = getShareCardCaptureKey(base, null, 'America/New_York');
    expect(india).not.toBe(usa);
  });
});
