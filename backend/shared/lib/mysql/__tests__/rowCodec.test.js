import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRow } from '../rowCodec.js';

const table = {
  fields: new Map([
    ['recovered_health_issues', { type: 'Json' }],
  ]),
};

describe('normalizeRow JSON columns', () => {
  it('parses a JSON array string into an array', () => {
    const row = normalizeRow(
      { recovered_health_issues: '["Knee Pain","Back Pain"]' },
      table,
    );
    assert.deepEqual(row.recovered_health_issues, ['Knee Pain', 'Back Pain']);
  });

  it('leaves an already parsed array unchanged', () => {
    const row = normalizeRow(
      { recovered_health_issues: ['Diabetes'] },
      table,
    );
    assert.deepEqual(row.recovered_health_issues, ['Diabetes']);
  });
});
