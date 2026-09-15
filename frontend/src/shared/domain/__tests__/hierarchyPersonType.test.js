/**
 * Run: node --test frontend/src/shared/domain/__tests__/hierarchyPersonType.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatHierarchyPersonType,
  HIERARCHY_PERSON_TYPE_COLUMN_LABEL,
} from '../hierarchyPersonType.js';

describe('hierarchyPersonType', () => {
  it('labels no-team people as Customer and downline owners as Sponsor', () => {
    assert.equal(formatHierarchyPersonType('member'), 'Customer');
    assert.equal(formatHierarchyPersonType('sponsor'), 'Sponsor');
    assert.equal(formatHierarchyPersonType(null), 'Customer');
  });

  it('uses Type as the column label', () => {
    assert.equal(HIERARCHY_PERSON_TYPE_COLUMN_LABEL, 'Type');
  });
});
