/**
 * Run: node --test backend/features/coach-portfolio/__tests__/offering-emoji.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { offeringEmoji, offeringsWithEmoji } from '../domain/offering-emoji.rules.js';
import { shortPublicText } from '../domain/public-copy.rules.js';

describe('offering-emoji.rules', () => {
  it('maps weight gain / loss / management distinctly', () => {
    assert.equal(offeringEmoji('Weight Gain Program'), '📈');
    assert.equal(offeringEmoji('Weight Loss Guidance'), '📉');
    assert.equal(offeringEmoji('Weight Management Guidance'), '🏋️');
  });

  it('maps the six default portfolio programs', () => {
    assert.equal(offeringEmoji('Family Healthy Breakfast Programme'), '🥗');
    assert.equal(offeringEmoji('Weight Loss'), '📉');
    assert.equal(offeringEmoji('Weight Gain'), '📈');
    assert.equal(offeringEmoji('Kids Nutrition'), '🧒');
    assert.equal(offeringEmoji('Sports Nutrition'), '🏃');
    assert.equal(offeringEmoji('Targeted Nutrition'), '🎯');
  });

  it('builds emoji cards for offerings', () => {
    const cards = offeringsWithEmoji(['Nutrition Education', 'Online Wellness Consultation']);
    assert.equal(cards.length, 2);
    assert.equal(cards[0].emoji, '🥗');
    assert.equal(cards[1].emoji, '💬');
  });
});

describe('public-copy.rules', () => {
  it('keeps short text unchanged and truncates long copy', () => {
    assert.equal(shortPublicText('Hello world', 40), 'Hello world');
    const long = 'Small daily actions and weekly check-ins help families build sustainable wellness habits over time with clear accountability.';
    const out = shortPublicText(long, 60);
    assert.ok(out.length <= 60);
    assert.ok(out.endsWith('…'));
  });
});
