/**
 * Run: node --test backend/features/user/domain/__tests__/aggregate-eligibility.rules.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterPublicAggregateUsers,
  filterAncestorsForIdealCoach,
  sanitizeSponsorCoachLabels,
  shouldExcludeDeveloperFromAggregates,
} from '../aggregate-eligibility.rules.js';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe('aggregate-eligibility.rules (non-production)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });
  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('does not filter developers outside production', () => {
    const users = [{ UserId: 1, Role: 'developer' }, { UserId: 2, Role: 'user' }];
    assert.equal(filterPublicAggregateUsers(users).length, 2);
    assert.equal(shouldExcludeDeveloperFromAggregates({ UserId: 1, Role: 'developer' }), false);
  });
});

describe('aggregate-eligibility.rules (production)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
  });
  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('excludes developers from public aggregates but keeps self-access', () => {
    const users = [
      { UserId: 1, Role: 'developer' },
      { UserId: 2, Role: 'user' },
      { UserId: 3, Role: 'developer' },
    ];
    assert.deepEqual(
      filterPublicAggregateUsers(users).map((u) => u.UserId),
      [2],
    );
    assert.equal(
      shouldExcludeDeveloperFromAggregates({ UserId: 1, Role: 'developer' }, { viewerUserId: 1 }),
      false,
    );
    assert.deepEqual(
      filterPublicAggregateUsers(users, { viewerUserId: 3 }).map((u) => u.UserId),
      [2, 3],
    );
  });

  it('skips developer ancestors for ideal coach in production', () => {
    const roleByUserId = new Map([
      ['10', 'developer'],
      ['11', 'coach'],
    ]);
    const filtered = filterAncestorsForIdealCoach([
      { userId: '10' },
      { userId: '11' },
    ], roleByUserId);
    assert.deepEqual(filtered.map((n) => n.userId), ['11']);
  });

  it('masks developer sponsor/coach unless self-view', () => {
    const roleByUserId = new Map([
      ['10', 'developer'],
      ['11', 'developer'],
    ]);
    const raw = {
      sponsorId: '10',
      sponsorName: 'Dev Sponsor',
      idealCoachId: '11',
      idealCoachName: 'Dev Coach',
    };
    const masked = sanitizeSponsorCoachLabels(raw, {
      memberUserId: 99,
      roleByUserId,
    });
    assert.equal(masked.sponsorName, null);
    assert.equal(masked.idealCoachName, null);

    const selfViewMember = sanitizeSponsorCoachLabels(raw, {
      memberUserId: 99,
      viewerUserId: 99,
      roleByUserId: new Map([['99', 'user'], ...roleByUserId]),
    });
    assert.equal(selfViewMember.sponsorName, null);

    const selfViewDeveloper = sanitizeSponsorCoachLabels(raw, {
      memberUserId: 99,
      viewerUserId: 99,
      roleByUserId: new Map([['99', 'developer'], ...roleByUserId]),
    });
    assert.equal(selfViewDeveloper.sponsorName, 'Dev Sponsor');
    assert.equal(selfViewDeveloper.idealCoachName, 'Dev Coach');
  });

  it('keeps the developer-bot sponsor label visible for onboarding tests', () => {
    const roleByUserId = new Map([['10', 'developer']]);
    const kept = sanitizeSponsorCoachLabels({
      sponsorId: '10',
      sponsorName: 'developer bot',
      idealCoachId: null,
      idealCoachName: null,
    }, {
      memberUserId: 99,
      viewerUserId: 99,
      roleByUserId,
    });
    assert.equal(kept.sponsorName, 'developer bot');
    assert.equal(kept.sponsorId, '10');
  });
});
