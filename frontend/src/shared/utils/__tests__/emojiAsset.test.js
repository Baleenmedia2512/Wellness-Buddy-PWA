/**
 * Weight profile icons must resolve to bundled Twemoji SVGs (iOS WebView).
 * Run: node --test frontend/src/shared/utils/__tests__/emojiAsset.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emojiToAssetName } from '../emojiAsset.js';

const emojiDir = join(dirname(fileURLToPath(import.meta.url)), '../../../../public/emoji');

const WEIGHT_ICONS = [
  ['🏁', '1f3c1'], // Initial Weight
  ['🔥', '1f525'], // Loss Mode / Weight Loss Phase
  ['💪', '1f4aa'], // Gain Mode
  ['⚖️', '2696'],  // Ideal Weight / Maintain / Current Weight (profile)
  ['📊', '1f4ca'], // Current Weight (team profile)
  ['🏋️', '1f3cb'], // Weight Gain Phase
  ['✅', '2705'],  // At Ideal Weight
  ['🎯', '1f3af'], // At Ideal Weight target
];

describe('emojiToAssetName — weight profile icons', () => {
  for (const [emoji, expected] of WEIGHT_ICONS) {
    it(`maps ${emoji} to ${expected}.svg and the asset exists`, () => {
      assert.equal(emojiToAssetName(emoji), expected);
      assert.equal(existsSync(join(emojiDir, `${expected}.svg`)), true, `missing public/emoji/${expected}.svg`);
    });
  }
});
