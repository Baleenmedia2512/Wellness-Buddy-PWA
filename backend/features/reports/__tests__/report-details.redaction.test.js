/**
 * Run: node --test backend/features/reports/__tests__/report-details.redaction.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  redactDownlineWeightResponse,
  redactWellnessScoreResponse,
} from '../domain/report-details.redaction.js';

describe('report detail redaction', () => {
  it('keeps names and drops weight numbers', () => {
    const source = {
      userId: 9,
      userName: 'Asha',
      currentWeight: 70,
      idealMin: 50,
      idealMax: 60,
      status: 'above_ideal',
      teamPerformance: { onTrackPct: 10 },
    };
    const result = redactDownlineWeightResponse({
      httpStatus: 200,
      body: {
        success: true,
        data: {
          self: source,
          members: [source],
          statusCounts: { off_track: 1, on_track: 0, no_data: 0, all: 1 },
        },
      },
    });
    assert.equal(result.body.data.members[0].userName, 'Asha');
    assert.equal(result.body.data.members[0].currentWeight, null);
    assert.equal(result.body.data.members[0].status, null);
    assert.equal(result.body.data.members[0].teamPerformance, null);
    assert.equal(result.body.data.statusCounts.all, 1);
    assert.equal(result.body.data.statusCounts.off_track, 0);
    assert.equal(source.currentWeight, 70);
  });

  it('keeps wellness names and drops scores', () => {
    const row = {
      userId: 3,
      name: 'Ravi',
      sponsor: 'Meera',
      todayWeight: 80,
      previousWeight: 81,
      difference: -1,
      percentage: 90,
      totalEarned: 20,
      wellnessScore: 20,
    };
    const result = redactWellnessScoreResponse({
      httpStatus: 200,
      body: { success: true, data: { members: [row] } },
    });
    assert.equal(result.body.data.members[0].name, 'Ravi');
    assert.equal(result.body.data.members[0].sponsor, 'Meera');
    assert.equal(result.body.data.members[0].todayWeight, null);
    assert.equal(result.body.data.members[0].wellnessScore, null);
    assert.equal(row.todayWeight, 80);
  });
});
