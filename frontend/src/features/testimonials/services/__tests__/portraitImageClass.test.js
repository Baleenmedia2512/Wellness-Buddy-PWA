/**
 * Run: node --test frontend/src/features/testimonials/services/__tests__/portraitImageClass.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PORTRAIT_IMAGE_CLASS,
  PORTRAIT_IMAGE_CLASS_SM,
} from '../testimonialFormUtils.js';

describe('portrait frame classes', () => {
  it('fills the 9:16 frame with cover, top-anchored so faces are not cropped', () => {
    assert.match(PORTRAIT_IMAGE_CLASS, /aspect-\[9\/16\]/);
    assert.match(PORTRAIT_IMAGE_CLASS, /object-cover/);
    assert.match(PORTRAIT_IMAGE_CLASS, /object-top/);
    assert.equal(/object-contain/.test(PORTRAIT_IMAGE_CLASS), false);
    assert.equal(/object-center/.test(PORTRAIT_IMAGE_CLASS), false);
    assert.match(PORTRAIT_IMAGE_CLASS_SM, /object-cover/);
    assert.match(PORTRAIT_IMAGE_CLASS_SM, /object-top/);
    assert.equal(/object-contain/.test(PORTRAIT_IMAGE_CLASS_SM), false);
    assert.equal(/object-center/.test(PORTRAIT_IMAGE_CLASS_SM), false);
  });
});
