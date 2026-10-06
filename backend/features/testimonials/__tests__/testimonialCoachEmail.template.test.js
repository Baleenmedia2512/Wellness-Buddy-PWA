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
  buildShareCardRow,
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

  it('embeds the Transformation share card and still shows Before/After photos', () => {
    const html = buildTestimonialCoachEmailHtml({
      memberName: 'Alex',
      goalType: 'loss',
      beforeWeight: 80,
      afterWeight: 70,
      durationText: '12 weeks',
      otp: '1234',
      beforeUrl: 'https://example.com/before.jpg',
      afterUrl: 'https://example.com/after.jpg',
      recoveredHealthIssues: ['Knee Pain'],
      shareCardSrc: 'cid:transformation-card@wellnessvalley',
    });
    assert.match(html, /Transformation Card/);
    assert.match(html, /cid:transformation-card@wellnessvalley/);
    assert.match(html, /before\/after photos/i);
    assert.match(html, />Before</);
    assert.match(html, />After</);
    assert.match(html, /Recovered Health Issues/);
    const imgs = photoImgs(html);
    assert.equal(imgs.length, 3); // share card + before + after
    imgs.forEach(assertPhotoKeepsAspectRatio);
  });

  it('buildShareCardRow returns empty when src missing', () => {
    assert.equal(buildShareCardRow(null), '');
    assert.equal(buildShareCardRow(''), '');
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
    // previous before + new before + new after + current before + current after
    assert.equal(imgs.length, 5);
    imgs.forEach(assertPhotoKeepsAspectRatio);
    assert.match(html, /New Upload/);
    assert.match(html, /Alex has lost 10 kg in 12 weeks/);
    assert.match(html, /border-radius:9999px/);
    assert.match(html, />Duration</);
    assert.match(html, /12 weeks/);
    assert.doesNotMatch(html, /\.photo-img\s*\{[^}]*height:\s*\d+px/);
  });

  it('unified email shows share card plus previous/new diffs and current Before/After', () => {
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
      recoveredHealthIssues: ['Knee Pain'],
      isComplete: true,
      shareCardSrc: 'cid:transformation-card@wellnessvalley',
    });
    assert.match(html, /Transformation Card/);
    assert.match(html, /cid:transformation-card@wellnessvalley/);
    assert.match(html, /Previous/);
    assert.match(html, /New Upload/);
    assert.match(html, />Before</);
    assert.match(html, />After</);
    assert.doesNotMatch(html, /Recovered Health Issues/);
    // share card + previous before + new before + new after (first upload) + current before + current after
    assert.ok(photoImgs(html).length >= 4);
  });
});
