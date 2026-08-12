/**
 * Unit tests for testimonials list pagination helpers.
 * Run: node --test backend/features/testimonials/__tests__/testimonials-list.pagination.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTestimonialsListPagination,
  computeUploadCompletenessFromRow,
  filterTestimonialsListBySearch,
  filterTestimonialsListByUpload,
  paginateTestimonialsList,
  countTestimonialsUploadLevels,
  mapTestimonialsListLeanFields,
} from '../domain/testimonials-list.pagination.js';

describe('normalizeTestimonialsListPagination', () => {
  it('defaults to page 1, limit 10, direct, all', () => {
    const n = normalizeTestimonialsListPagination({});
    assert.equal(n.page, 1);
    assert.equal(n.limit, 10);
    assert.equal(n.scope, 'direct');
    assert.equal(n.uploadFilter, 'all');
    assert.equal(n.search, '');
  });

  it('caps limit at 50 and accepts search/scope/filter', () => {
    const n = normalizeTestimonialsListPagination({
      page: '2',
      limit: '999',
      search: '  Priya ',
      scope: 'full',
      uploadFilter: 'partial_upload',
      coachId: '339',
    });
    assert.equal(n.page, 2);
    assert.equal(n.limit, 50);
    assert.equal(n.search, 'priya');
    assert.equal(n.scope, 'full');
    assert.equal(n.uploadFilter, 'partial_upload');
    assert.equal(n.coachId, 339);
  });
});

describe('computeUploadCompletenessFromRow', () => {
  it('returns not_uploaded for null', () => {
    assert.equal(computeUploadCompletenessFromRow(null).level, 'not_uploaded');
  });

  it('counts five slots for a full row', () => {
    const c = computeUploadCompletenessFromRow({
      before_image_path: '1/before.jpg',
      after_image_path: '1/after.jpg',
      status: 'verified',
      health_video_path: '1/h.mp4',
      business_video_path: '1/b.mp4',
      recovered_health_issues: ['Diabetes'],
    });
    assert.equal(c.filledCount, 5);
    assert.equal(c.level, 'fully_uploaded');
  });
});

describe('filter + paginate', () => {
  const rows = [
    { user: { UserName: 'Alpha' }, uploadLevel: 'fully_uploaded', testimonial: {} },
    { user: { UserName: 'Beta' }, uploadLevel: 'partial_upload', testimonial: {} },
    { user: { UserName: 'Gamma' }, uploadLevel: 'not_uploaded', testimonial: null },
  ];

  it('filters by search name', () => {
    assert.equal(filterTestimonialsListBySearch(rows, 'bet').length, 1);
  });

  it('filters by upload level', () => {
    assert.equal(filterTestimonialsListByUpload(rows, 'partial_upload').length, 1);
  });

  it('paginates with hasMore', () => {
    const { pageRows, pagination } = paginateTestimonialsList(rows, { page: 1, limit: 2 });
    assert.equal(pageRows.length, 2);
    assert.equal(pagination.total, 3);
    assert.equal(pagination.hasMore, true);
  });

  it('counts upload levels', () => {
    const c = countTestimonialsUploadLevels(rows);
    assert.equal(c.fully_uploaded, 1);
    assert.equal(c.partial_upload, 1);
    assert.equal(c.not_uploaded, 1);
  });
});

describe('mapTestimonialsListLeanFields', () => {
  it('maps member without testimonial', () => {
    const lean = mapTestimonialsListLeanFields({
      user: { UserId: 5, UserName: 'X', PhoneNumber: '1' },
      testimonial: null,
    });
    assert.equal(lean.userId, 5);
    assert.equal(lean.uploadStatus, 'not_uploaded');
    assert.equal(lean.beforeImagePath, null);
  });
});
