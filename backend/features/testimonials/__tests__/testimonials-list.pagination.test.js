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
  filterTestimonialsListByHealthIssue,
  filterTestimonialsListByUpload,
  paginateTestimonialsList,
  countTestimonialsUploadLevels,
  mapTestimonialsListLeanFields,
  orderTeamMembersDirectFirst,
} from '../domain/testimonials-list.pagination.js';

describe('normalizeTestimonialsListPagination', () => {
  it('defaults to page 1, limit 10, direct, all', () => {
    const n = normalizeTestimonialsListPagination({});
    assert.equal(n.page, 1);
    assert.equal(n.limit, 10);
    assert.equal(n.scope, 'direct');
    assert.equal(n.uploadFilter, 'all');
    assert.equal(n.search, '');
    assert.equal(n.healthIssue, '');
  });

  it('caps limit at 50 and accepts search/healthIssue/scope/filter', () => {
    const n = normalizeTestimonialsListPagination({
      page: '2',
      limit: '999',
      search: '  Priya ',
      healthIssue: '  Back Pain ',
      scope: 'full',
      uploadFilter: 'partial_upload',
      coachId: '339',
    });
    assert.equal(n.page, 2);
    assert.equal(n.limit, 50);
    assert.equal(n.search, 'priya');
    assert.equal(n.healthIssue, 'back pain');
    assert.equal(n.scope, 'full');
    assert.equal(n.uploadFilter, 'partial_upload');
    assert.equal(n.coachId, 339);
  });
});

describe('computeUploadCompletenessFromRow', () => {
  it('returns not_uploaded for null', () => {
    assert.equal(computeUploadCompletenessFromRow(null).level, 'not_uploaded');
  });

  it('counts four slots for a full row (collage photo = one)', () => {
    const c = computeUploadCompletenessFromRow({
      before_image_path: '1/before.jpg',
      after_image_path: '1/after.jpg',
      status: 'verified',
      health_video_path: '1/h.mp4',
      business_video_path: '1/b.mp4',
      recovered_health_issues: ['Diabetes'],
    });
    assert.equal(c.filledCount, 4);
    assert.equal(c.totalSlots, 4);
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

    it('name search does not match health issues', () => {
      const withIssues = [
        ...rows,
        {
          user: { UserName: 'Delta' },
          uploadLevel: 'partial_upload',
          recoveredHealthIssues: ['Back Pain', 'Diabetes'],
        },
      ];
      assert.equal(filterTestimonialsListBySearch(withIssues, 'back').length, 0);
    });

    it('filters by recovered health issue', () => {
      const withIssues = [
        ...rows,
        {
          user: { UserName: 'Delta' },
          uploadLevel: 'partial_upload',
          recoveredHealthIssues: ['Back Pain', 'Diabetes'],
        },
      ];
      const matched = filterTestimonialsListByHealthIssue(withIssues, 'back');
      assert.equal(matched.length, 1);
      assert.equal(matched[0].user.UserName, 'Delta');
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

describe('normalizeTestimonialsListPagination team scope & direct-first ordering', () => {
  it('accepts scope=team and custom limit=5', () => {
    const n = normalizeTestimonialsListPagination({ scope: 'team', page: 1, limit: 5 });
    assert.equal(n.scope, 'team');
    assert.equal(n.limit, 5);
  });

  it('orders all direct team members first (A-Z) then full-team indirect members (A-Z) across 5-per-page slices', () => {
    const direct = [
      { UserId: 10, UserName: 'Zack', Status: 'Active' },
      { UserId: 11, UserName: 'Bala', Status: 'Active' },
      { UserId: 12, UserName: 'Deepa', Status: 'Active' },
      { UserId: 13, UserName: 'Karthik', Status: 'Active' },
      { UserId: 14, UserName: 'Meena', Status: 'Active' },
      { UserId: 15, UserName: 'Ramesh', Status: 'Active' },
      { UserId: 99, UserName: 'Inactive Direct', Status: 'Inactive' },
    ];
    const full = [
      ...direct,
      { UserId: 20, UserName: 'Aaron Indirect', Status: 'Active' },
      { UserId: 21, UserName: 'Priya Indirect', Status: 'Active' },
      { UserId: 1, UserName: 'Self Coach', Status: 'Active' },
    ];

    const ordered = orderTeamMembersDirectFirst(
      direct,
      full,
      1,
      (status) => status === 'Active',
    );
    assert.deepEqual(
      ordered.map((m) => m.UserName),
      ['Bala', 'Deepa', 'Karthik', 'Meena', 'Ramesh', 'Zack', 'Aaron Indirect', 'Priya Indirect'],
    );

    const p1 = paginateTestimonialsList(ordered, { page: 1, limit: 5 });
    assert.deepEqual(
      p1.pageRows.map((m) => m.UserName),
      ['Bala', 'Deepa', 'Karthik', 'Meena', 'Ramesh'],
    );
    assert.equal(p1.pagination.hasMore, true);

    const p2 = paginateTestimonialsList(ordered, { page: 2, limit: 5 });
    assert.deepEqual(
      p2.pageRows.map((m) => m.UserName),
      ['Zack', 'Aaron Indirect', 'Priya Indirect'],
    );
    assert.equal(p2.pagination.hasMore, false);
  });
});
