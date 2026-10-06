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
  buildTransformationCardEmailBlock,
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

  it('embeds Transformation card with Before left and After right from real photo URLs', () => {
    const html = buildTestimonialCoachEmailHtml({
      memberName: 'Alex',
      goalType: 'loss',
      beforeWeight: 80,
      afterWeight: 70,
      durationText: '12 weeks',
      otp: '1234',
      beforeUrl: 'cid:transformation-before@wellnessvalley',
      afterUrl: 'cid:transformation-after@wellnessvalley',
      recoveredHealthIssues: ['Knee Pain'],
    });
    assert.match(html, /Transformation Card/);
    assert.match(html, /cid:transformation-before@wellnessvalley/);
    assert.match(html, /cid:transformation-after@wellnessvalley/);
    assert.match(html, /Before on the left, After on the right/);
    // Before CID must appear before After CID in the card markup.
    const beforeIdx = html.indexOf('cid:transformation-before@wellnessvalley');
    const afterIdx = html.indexOf('cid:transformation-after@wellnessvalley');
    assert.ok(beforeIdx > 0 && afterIdx > beforeIdx);
    const imgs = photoImgs(html);
    assert.equal(imgs.length, 2);
    imgs.forEach(assertPhotoKeepsAspectRatio);
  });

  it('buildTransformationCardEmailBlock puts before left and after right', () => {
    const html = buildTransformationCardEmailBlock({
      memberName: 'Alex',
      beforeUrl: 'https://example.com/before.jpg',
      afterUrl: 'https://example.com/after.jpg',
      beforeWeight: 90.9,
      afterWeight: 60.8,
      goalType: 'loss',
      durationText: '6 months',
      recoveredHealthIssues: [],
    });
    assert.match(html, /https:\/\/example\.com\/before\.jpg/);
    assert.match(html, /https:\/\/example\.com\/after\.jpg/);
    assert.ok(html.indexOf('before.jpg') < html.indexOf('after.jpg'));
    assert.match(html, /Lost 30\.1 kgs in 6 months/);
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
    // previous before + new before (first-upload after has no previous) + card before + card after
    // afterDiff first-upload: placeholder (no img) + new after img → + card before + card after
    assert.ok(imgs.length >= 4);
    imgs.forEach(assertPhotoKeepsAspectRatio);
    assert.match(html, /New Upload/);
    assert.match(html, /Transformation Card/);
    assert.match(html, /Lost 10 kgs in 12 weeks/);
    assert.match(html, /12 weeks/);
    assert.doesNotMatch(html, /\.photo-img\s*\{[^}]*height:\s*\d+px/);
  });

  it('unified email Transformation card uses Before left and After right', () => {
    const html = buildUnifiedSubmitEmailHtml({
      memberName: 'Alex',
      otp: '1234',
      changedSlots: ['after'],
      goalType: 'loss',
      beforeWeight: 90.9,
      afterWeight: 60.8,
      durationText: '6 months',
      beforeUrl: 'cid:transformation-before@wellnessvalley',
      afterUrl: 'cid:transformation-after@wellnessvalley',
      previousBeforeUrl: null,
      previousAfterUrl: 'https://example.com/after-old.jpg',
      healthVideoUrl: null,
      businessVideoUrl: null,
      recoveredHealthIssues: ['Knee Pain'],
      isComplete: true,
    });
    assert.match(html, /Transformation Card/);
    assert.match(html, /Previous/);
    const cardStart = html.indexOf('Transformation Card');
    const cardHtml = html.slice(cardStart);
    const beforeIdx = cardHtml.indexOf('cid:transformation-before@wellnessvalley');
    const afterIdx = cardHtml.indexOf('cid:transformation-after@wellnessvalley');
    assert.ok(beforeIdx >= 0 && afterIdx > beforeIdx);
  });
});
