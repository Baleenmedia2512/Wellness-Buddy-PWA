/**
 * Run: node --test backend/features/testimonials/__tests__/profileTransformationPhotos.seed.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isInlineImageReference,
  seedTestimonialFromProfilePhotos,
  memberHasVisibleTransformationPhoto,
} from '../domain/profileTransformationPhotos.seed.js';

describe('isInlineImageReference', () => {
  it('detects data URLs and https links', () => {
    assert.equal(isInlineImageReference('data:image/jpeg;base64,abc'), true);
    assert.equal(isInlineImageReference('https://cdn.example/photo.jpg'), true);
    assert.equal(isInlineImageReference('42/before.jpg'), false);
    assert.equal(isInlineImageReference(''), false);
  });
});

describe('seedTestimonialFromProfilePhotos', () => {
  it('returns null when no testimonial and no left photo', () => {
    assert.equal(seedTestimonialFromProfilePhotos(null, {}), null);
  });

  it('seeds before and after from profile left slot', () => {
    const seeded = seedTestimonialFromProfilePhotos(null, {
      left: 'https://cdn.example/left.jpg',
    });
    assert.equal(seeded.before_image_path, 'https://cdn.example/left.jpg');
    assert.equal(seeded.after_image_path, 'https://cdn.example/left.jpg');
    assert.equal(seeded.status, 'incomplete');
  });

  it('overwrites existing testimonial before path with profile left', () => {
    const seeded = seedTestimonialFromProfilePhotos(
      { before_image_path: '99/real.jpg', after_image_path: null, status: 'incomplete' },
      { left: 'https://cdn.example/left.jpg' },
    );
    // Existing Before → Profile Left ignored
    assert.equal(seeded.before_image_path, '99/real.jpg');
  });

  it('keeps testimonial After when only profile left changes on pending row', () => {
    const seeded = seedTestimonialFromProfilePhotos(
      {
        before_image_path: '99/before.jpg',
        after_image_path: '99/after.jpg',
        status: 'pending',
      },
      { left: 'https://cdn.example/left.jpg' },
    );
    assert.equal(seeded.before_image_path, '99/before.jpg');
    assert.equal(seeded.after_image_path, '99/after.jpg');
  });

  it('does not overwrite pending After when profile right is provided', () => {
    const seeded = seedTestimonialFromProfilePhotos(
      {
        before_image_path: '99/before.jpg',
        after_image_path: '99/after.jpg',
        status: 'pending',
      },
      { right: 'https://cdn.example/right.jpg' },
    );
    assert.equal(seeded.after_image_path, '99/after.jpg');
  });

  it('seeds both before and after from left even when profile right exists', () => {
    const seeded = seedTestimonialFromProfilePhotos(null, {
      left: 'https://cdn.example/left.jpg',
      right: 'https://cdn.example/right.jpg',
    });
    assert.equal(seeded.before_image_path, 'https://cdn.example/left.jpg');
    assert.equal(seeded.after_image_path, 'https://cdn.example/left.jpg');
  });

  it('does not replace stored after when profile left changes', () => {
    const seeded = seedTestimonialFromProfilePhotos(
      {
        before_image_path: '99/old-left.jpg',
        after_image_path: '99/old-left.jpg',
        status: 'incomplete',
      },
      {
        left: 'https://cdn.example/new-left.jpg',
        right: 'https://cdn.example/right.jpg',
      },
    );
    assert.equal(seeded.before_image_path, '99/old-left.jpg');
    assert.equal(seeded.after_image_path, '99/old-left.jpg');
  });

  it('replaces incomplete profile-right auto after with left', () => {
    const seeded = seedTestimonialFromProfilePhotos(
      {
        before_image_path: '99/before_1700000000000.jpg',
        after_image_path: '99/after_1700000001000.jpg',
        status: 'incomplete',
      },
      {
        left: 'https://cdn.example/left.jpg',
        right: 'https://cdn.example/right.jpg',
      },
    );
    // Existing Before → leave unchanged
    assert.equal(seeded.before_image_path, '99/before_1700000000000.jpg');
    assert.equal(seeded.after_image_path, '99/after_1700000001000.jpg');
  });

  it('ignores profile right when it is the only slot', () => {
    const seeded = seedTestimonialFromProfilePhotos(null, {
      right: 'https://cdn.example/right.jpg',
    });
    assert.equal(seeded, null);
  });
});

describe('memberHasVisibleTransformationPhoto', () => {
  it('counts profile left slot when testimonial is missing', () => {
    assert.equal(
      memberHasVisibleTransformationPhoto(null, { left: 'https://cdn.example/left.jpg' }),
      true,
    );
  });

  it('counts testimonial before path', () => {
    assert.equal(
      memberHasVisibleTransformationPhoto({ before_image_path: '1/before.jpg' }, null),
      true,
    );
  });
});
