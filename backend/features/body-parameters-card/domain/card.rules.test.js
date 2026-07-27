/**
 * Unit tests for Body Parameters Card domain rules.
 * Run: node --test backend/features/body-parameters-card/domain/card.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTeamMemberInsert,
  shouldClearBpcLeadCoachId,
  shouldDetachCounsellorCoachAssignment,
} from './card.rules.js';

describe('buildTeamMemberInsert', () => {
  it('never assigns CoachId (coach chosen at onboarding only)', () => {
    const row = buildTeamMemberInsert({
      name: 'Ada',
      heightCm: 170,
      bmr: 1500,
      weightKg: 70,
      fatPercent: 20,
    });
    assert.equal(row.CoachId, null);
    assert.equal(row.UserName, 'Ada');
  });

  it('ignores accidental counsellor / coach fields on the input', () => {
    const row = buildTeamMemberInsert({
      name: 'Ada',
      coachId: 99,
      createdBy: 99,
      counsellorId: 99,
    });
    assert.equal(row.CoachId, null);
  });
});

describe('shouldClearBpcLeadCoachId', () => {
  it('clears any CoachId on a BPC lead without OTP approval', () => {
    assert.equal(
      shouldClearBpcLeadCoachId({
        currentCoachId: 339,
        entryUser: 'Body Parameters Card',
        setupSkipped: false,
        hasApprovedCoachSelection: false,
      }),
      true,
    );
  });

  it('does not clear when CoachId is already null', () => {
    assert.equal(
      shouldClearBpcLeadCoachId({
        currentCoachId: null,
        entryUser: 'Body Parameters Card',
        hasApprovedCoachSelection: false,
      }),
      false,
    );
  });

  it('keeps CoachId when user completed OTP coach selection', () => {
    assert.equal(
      shouldClearBpcLeadCoachId({
        currentCoachId: 42,
        entryUser: 'Body Parameters Card',
        hasApprovedCoachSelection: true,
      }),
      false,
    );
  });

  it('keeps CoachId when setup was skipped with a chosen coach', () => {
    assert.equal(
      shouldClearBpcLeadCoachId({
        currentCoachId: 42,
        entryUser: 'Body Parameters Card',
        setupSkipped: true,
        hasApprovedCoachSelection: false,
      }),
      false,
    );
  });

  it('does not clear non-BPC members', () => {
    assert.equal(
      shouldClearBpcLeadCoachId({
        currentCoachId: 42,
        entryUser: 'Wellness Valley',
        hasApprovedCoachSelection: false,
      }),
      false,
    );
  });
});

describe('shouldDetachCounsellorCoachAssignment', () => {
  it('clears legacy BPC lead where counsellor was auto-assigned as coach', () => {
    assert.equal(
      shouldDetachCounsellorCoachAssignment({
        currentCoachId: 42,
        counsellorId: 42,
        entryUser: 'Body Parameters Card',
        setupSkipped: false,
        hasApprovedCoachSelection: false,
      }),
      true,
    );
  });

  it('requires counsellorId match when using legacy helper', () => {
    assert.equal(
      shouldDetachCounsellorCoachAssignment({
        currentCoachId: 7,
        counsellorId: 42,
        entryUser: 'Body Parameters Card',
        setupSkipped: false,
        hasApprovedCoachSelection: false,
      }),
      false,
    );
  });
});
