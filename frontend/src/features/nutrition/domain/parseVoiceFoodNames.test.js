/**
 * parseVoiceFoodNames.test.js
 *
 * Run: npx react-scripts test --watchAll=false --testPathPattern=parseVoiceFoodNames
 */
import { parseVoiceFoodNames } from './parseVoiceFoodNames';

describe('parseVoiceFoodNames', () => {
  test('splits multi-name utterance on commas and and', () => {
    expect(parseVoiceFoodNames('rice, egg and banana')).toEqual([
      'rice',
      'egg',
      'banana',
    ]);
  });

  test('trims punctuation and drops filler noise', () => {
    expect(parseVoiceFoodNames('um, add chicken, and also rice please.')).toEqual([
      'chicken',
      'rice',
    ]);
  });

  test('splits on newlines', () => {
    expect(parseVoiceFoodNames('dal\nroti\ncurd')).toEqual(['dal', 'roti', 'curd']);
  });

  test('dedupes case-insensitively and caps at max', () => {
    const names = parseVoiceFoodNames(
      'rice and Rice and egg and banana and apple and milk and oats and toast and juice and soup',
      { max: 8 },
    );
    expect(names).toHaveLength(8);
    expect(names[0]).toBe('rice');
    expect(names).not.toContain('Rice');
  });

  test('returns empty for blank / noise-only', () => {
    expect(parseVoiceFoodNames('')).toEqual([]);
    expect(parseVoiceFoodNames('um uh please')).toEqual([]);
  });
});
