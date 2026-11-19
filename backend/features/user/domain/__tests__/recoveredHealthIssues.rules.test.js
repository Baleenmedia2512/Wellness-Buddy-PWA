import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapTeamRecoveredHealthIssues } from '../recoveredHealthIssues.rules.js';

describe('mapTeamRecoveredHealthIssues', () => {
  it('maps string array and trims', () => {
    assert.deepStrictEqual(mapTeamRecoveredHealthIssues([' Diabetes ', '', 1, 'BP']), ['Diabetes', 'BP']);
  });

  it('parses JSON string arrays', () => {
    assert.deepStrictEqual(mapTeamRecoveredHealthIssues('["Thyroid","PCOS"]'), ['Thyroid', 'PCOS']);
  });

  it('returns empty for null / invalid', () => {
    assert.deepStrictEqual(mapTeamRecoveredHealthIssues(null), []);
    assert.deepStrictEqual(mapTeamRecoveredHealthIssues(undefined), []);
    assert.deepStrictEqual(mapTeamRecoveredHealthIssues('not-json'), []);
  });
});
