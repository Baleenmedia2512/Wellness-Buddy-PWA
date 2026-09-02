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

  it('does not overwrite existing testimonial before path', () => {
    const seeded = seedTestimonialFromProfilePhotos(
      { before_image_path: '99/real.jpg', after_image_path: null, status: 'pending' },
      { left: 'https://cdn.example/left.jpg' },
    );
    assert.equal(seeded.before_image_path, '99/real.jpg');
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
