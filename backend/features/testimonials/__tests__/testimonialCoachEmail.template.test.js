/**
 * Coach verification emails must not lock photo height.
 * Fixed height + fluid width stretches/squashes portrait shots in Gmail.
 * Run: node --test backend/features/testimonials/__tests__/testimonialCoachEmail.template.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTestimonialCoachEmailHtml,
  buildUnifiedSubmitEmailHtml,
} from '../testimonialCoachEmail.template.js';

function photoImgs(html) {
  return [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
}

function assertPhotoKeepsAspectRatio(img) {
  assert.match(img, /height:\s*auto/);
  assert.match(img, /\bwidth="\d+"/);
  assert.doesNotMatch(img, /\bheight="\d+"/);
  assert.doesNotMatch(img, /height:\s*\d+px/);
}

describe('testimonial coach email photos keep aspect ratio', () => {
  it('does not lock img height on the initial verification email', () => {
    const html = buildTestimonialCoachEmailHtml({
      memberName: 'Alex',
      goalType: 'loss',
      beforeWeight: 80,
      afterWeight: 70,
      durationText: '12 weeks',
      otp: '1234',
      beforeUrl: 'https://example.com/before.jpg',
      afterUrl: 'https://example.com/after.jpg',
      recoveredHealthIssues: [],
    });
    const imgs = photoImgs(html);
    assert.equal(imgs.length, 2);
    imgs.forEach(assertPhotoKeepsAspectRatio);
    assert.doesNotMatch(html, /\.photo-img\s*\{[^}]*height:\s*\d+px/);
  });

  it('does not lock img height on first-upload or previous/new comparison photos', () => {
    const html = buildUnifiedSubmitEmailHtml({
      memberName: 'Alex',
      otp: '1234',
      changedSlots: ['before', 'after'],
      goalType: 'loss',
      beforeWeight: 80,
      afterWeight: 70,
      durationText: '12 weeks',
      beforeUrl: 'https://example.com/before-new.jpg',
      afterUrl: 'https://example.com/after-new.jpg',
      previousBeforeUrl: 'https://example.com/before-old.jpg',
      previousAfterUrl: null,
      healthVideoUrl: null,
      businessVideoUrl: null,
      recoveredHealthIssues: [],
      isComplete: true,
    });
    const imgs = photoImgs(html);
    assert.equal(imgs.length, 3);
    imgs.forEach(assertPhotoKeepsAspectRatio);
    assert.match(html, /New Upload/);
    assert.doesNotMatch(html, /\.photo-img\s*\{[^}]*height:\s*\d+px/);
  });
});
