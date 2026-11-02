/**
 * Run: node --test frontend/src/features/user/domain/workingPhysicalCentre.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveWorkingPhysicalCentreFromChain } from './workingPhysicalCentre.js';

const centers = [
  { id: 1, owner_user_id: 10, center_name: 'Old Club', registered_at: '2024-01-01T00:00:00Z' },
  { id: 2, owner_user_id: 10, center_name: 'New Club', registered_at: '2025-06-01T00:00:00Z' },
  { id: 3, owner_user_id: 20, center_name: 'Coach Club', registered_at: '2023-01-01T00:00:00Z' },
  { id: 4, owner_user_id: 30, center_name: 'Upline Club', registered_at: '2022-01-01T00:00:00Z' },
];

describe('resolveWorkingPhysicalCentreFromChain', () => {
  it('selects the member latest club', () => {
    const result = resolveWorkingPhysicalCentreFromChain(10, centers, [10, 20, 30]);
    assert.equal(result.name, 'New Club');
    assert.equal(result.id, 2);
    assert.deepEqual(result.options.map((opt) => opt.name), ['New Club', 'Old Club']);
  });

  it('uses the coach club when the member has none', () => {
    const result = resolveWorkingPhysicalCentreFromChain(99, centers, [99, 20, 30]);
    assert.equal(result.name, 'Coach Club');
  });

  it('uses the next upline when the coach has none', () => {
    const result = resolveWorkingPhysicalCentreFromChain(40, centers, [40, 41, 30]);
    assert.equal(result.name, 'Upline Club');
  });

  it('returns no club when the chain has none', () => {
    const result = resolveWorkingPhysicalCentreFromChain(1, centers, [1, 2]);
    assert.equal(result.name, null);
    assert.deepEqual(result.options, []);
  });
});
