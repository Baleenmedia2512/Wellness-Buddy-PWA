import { mapTeamRecoveredHealthIssues } from '../recoveredHealthIssues.rules.js';

describe('mapTeamRecoveredHealthIssues', () => {
  test('maps string array and trims', () => {
    expect(mapTeamRecoveredHealthIssues([' Diabetes ', '', 1, 'BP'])).toEqual(['Diabetes', 'BP']);
  });

  test('parses JSON string arrays', () => {
    expect(mapTeamRecoveredHealthIssues('["Thyroid","PCOS"]')).toEqual(['Thyroid', 'PCOS']);
  });

  test('returns empty for null / invalid', () => {
    expect(mapTeamRecoveredHealthIssues(null)).toEqual([]);
    expect(mapTeamRecoveredHealthIssues(undefined)).toEqual([]);
    expect(mapTeamRecoveredHealthIssues('not-json')).toEqual([]);
    expect(mapTeamRecoveredHealthIssues({})).toEqual([]);
  });
});
