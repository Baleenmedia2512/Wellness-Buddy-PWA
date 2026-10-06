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
  buildTransformationCardCompareRow,
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

  it('first update without previous After shows only the new Transformation Card', () => {
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
    assert.equal(imgs.length, 2); // current card Before + After only
    imgs.forEach(assertPhotoKeepsAspectRatio);
    assert.match(html, /Transformation Card/);
    assert.doesNotMatch(html, /Previous Transformation Card/);
    assert.doesNotMatch(html, /New Upload/);
    assert.match(html, /Lost 10 kgs in 12 weeks/);
    assert.doesNotMatch(html, /\.photo-img\s*\{[^}]*height:\s*\d+px/);
  });

  it('unified email shows Previous and New Transformation Cards side by side', () => {
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
      previousBeforeUrl: 'cid:transformation-before-prev@wellnessvalley',
      previousAfterUrl: 'cid:transformation-after-prev@wellnessvalley',
      previousBeforeWeight: 90.9,
      previousAfterWeight: 70,
      previousCardImageUrl: 'cid:transformation-card-prev@wellnessvalley',
      currentCardImageUrl: 'cid:transformation-card@wellnessvalley',
      previousPreviewHref: 'https://example.com/prev-card.jpg',
      currentPreviewHref: 'https://example.com/new-card.jpg',
      healthVideoUrl: null,
      businessVideoUrl: null,
      recoveredHealthIssues: ['Knee Pain'],
      isComplete: true,
    });
    assert.match(html, /Transformation Card/);
    assert.match(html, />Previous</);
    assert.match(html, />New</);
    assert.match(html, /Tap card to open full preview|Tap card to open preview/);
    assert.match(html, /cid:transformation-card-prev@wellnessvalley/);
    assert.match(html, /cid:transformation-card@wellnessvalley/);
    assert.match(html, /https:\/\/example\.com\/prev-card\.jpg/);
    assert.match(html, /https:\/\/example\.com\/new-card\.jpg/);
    const prevIdx = html.indexOf('>Previous<');
    const newIdx = html.indexOf('>New<');
    assert.ok(prevIdx >= 0 && newIdx > prevIdx);
    // Previous preview href wraps Previous; New href wraps New (never swapped).
    // Markup order: <a href=prev>…Previous…</a> … <a href=new>…New…</a>
    const prevHrefIdx = html.indexOf('https://example.com/prev-card.jpg');
    const newHrefIdx = html.indexOf('https://example.com/new-card.jpg');
    assert.ok(prevHrefIdx >= 0 && prevHrefIdx < prevIdx, 'prev preview href wraps Previous');
    assert.ok(newHrefIdx > prevIdx && newHrefIdx < newIdx, 'new preview href wraps New');
    assert.ok(prevHrefIdx < newHrefIdx);
    // One card image per side (not 4 loose before/after photos)
    assert.equal(photoImgs(html).length, 2);
  });

  it('compare row requires both previous and new pairs', () => {
    assert.equal(buildTransformationCardCompareRow({
      previousBeforeUrl: null,
      previousAfterUrl: null,
      beforeUrl: 'https://example.com/b.jpg',
      afterUrl: 'https://example.com/a.jpg',
      beforeWeight: 80,
      afterWeight: 70,
    }), '');
  });
});
