/**
 * Run: node --test frontend/src/features/leaderboard/domain/__tests__/avatarFallback.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAvatarFallbackDataUri, COLOR_HEXES } from '../avatarFallback.rules.js';

describe('avatarFallback.rules', () => {
  it('has 8 distinct hex colors matching Tailwind palette', () => {
    assert.equal(COLOR_HEXES.length, 8);
    assert.equal(COLOR_HEXES[7], '#14b8a6'); // teal-500
  });

  it('generates a centered SVG data URI with dominant-baseline="central"', () => {
    const uri = buildAvatarFallbackDataUri('S', '#14b8a6');
    assert.match(uri, /^data:image\/svg\+xml;utf8,/);
    const decoded = decodeURIComponent(uri.replace(/^data:image\/svg\+xml;utf8,/, ''));
    assert.match(decoded, /dominant-baseline="central"/);
    assert.match(decoded, /text-anchor="middle"/);
    assert.match(decoded, /fill="#14b8a6"/);
    assert.match(decoded, />S<\/text>/);
  });

  it('uppercases initial and escapes XML', () => {
    const uri = buildAvatarFallbackDataUri('&', '#ef4444');
    const decoded = decodeURIComponent(uri.replace(/^data:image\/svg\+xml;utf8,/, ''));
    assert.match(decoded, />&amp;<\/text>/);
  });

  it('falls back to ? when initial is empty or null', () => {
    const uri = buildAvatarFallbackDataUri(null);
    const decoded = decodeURIComponent(uri.replace(/^data:image\/svg\+xml;utf8,/, ''));
    assert.match(decoded, />\?<\/text>/);
  });
});
