/**
 * Run: node --test frontend/src/shared/utils/shareCaption.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { composeQuickShareCaption } from './shareCaption.js';

describe('composeQuickShareCaption', () => {
  it('keeps WhatsApp-formatted suffixes on a new line under the brand', () => {
    assert.equal(
      composeQuickShareCaption(
        'Balaji Sekar · Wellness Valley v 3.4.5',
        '*Daily Education · Zoom,*',
      ),
      'Balaji Sekar · Wellness Valley v 3.4.5,\n*Daily Education · Zoom,*',
    );
  });

  it('keeps weight-style multi-line captions separated by a blank line', () => {
    assert.equal(
      composeQuickShareCaption(
        'Balaji Sekar · Wellness Valley v 3.4.5',
        'Ideal: 73.7 kg\nBefore: 73.4 kg\nAfter: 72.9 kg ⬇️',
      ),
      'Balaji Sekar · Wellness Valley v 3.4.5\n\nIdeal: 73.7 kg\nBefore: 73.4 kg\nAfter: 72.9 kg ⬇️',
    );
  });
});
