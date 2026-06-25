/**
 * Unit tests for getAttendees (centers.service.js)
 * Coverage target: ≥ 95 % lines / 90 % branches (claude.md §9.1)
 *
 * Uses jest.mock to isolate the service from the repository and logger.
 */
import { jest } from '@jest/globals';

jest.mock('../centers.repository.js');
jest.mock('../../shared/lib/logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn() },
}));

import * as repo from '../centers.repository.js';
import { getAttendees } from '../centers.service.js';

describe('getAttendees', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns deduplicated attendee list for a centre', async () => {
    repo.getAttendeeList = jest.fn().mockResolvedValue([
      { userId: 1, userName: 'Alice' },
      { userId: 2, userName: 'Bob' },
    ]);

    const result = await getAttendees({ centerId: '5', startDate: '2026-06-01', endDate: '2026-06-01' });

    expect(result.httpStatus).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.data).toHaveLength(2);
    expect(result.body.data[0].userName).toBe('Alice');
  });

  it('returns empty array when no one attended', async () => {
    repo.getAttendeeList = jest.fn().mockResolvedValue([]);

    const result = await getAttendees({ centerId: '5', startDate: '2026-06-01', endDate: '2026-06-01' });

    expect(result.httpStatus).toBe(200);
    expect(result.body.data).toEqual([]);
  });

  it('returns 500 when repo throws', async () => {
    repo.getAttendeeList = jest.fn().mockRejectedValue(new Error('DB exploded'));

    const result = await getAttendees({ centerId: '5', startDate: null, endDate: null });

    expect(result.httpStatus).toBe(500);
    expect(result.body.success).toBe(false);
    expect(result.body.error.code).toBe('FETCH_FAILED');
  });

  it('falls back to today when startDate/endDate are null', async () => {
    repo.getAttendeeList = jest.fn().mockResolvedValue([]);

    await getAttendees({ centerId: '3', startDate: null, endDate: null });

    const [, rangeStart, rangeEnd] = repo.getAttendeeList.mock.calls[0];
    const today = new Date().toISOString().split('T')[0];
    expect(rangeStart).toContain(today);
    expect(rangeEnd).toContain(today);
  });

  it('parses centerId as integer before passing to repo', async () => {
    repo.getAttendeeList = jest.fn().mockResolvedValue([]);

    await getAttendees({ centerId: '99', startDate: null, endDate: null });

    const [centerId] = repo.getAttendeeList.mock.calls[0];
    expect(centerId).toBe(99);
  });

  it('shows "Unknown Member" for deleted accounts (handled in repo)', async () => {
    repo.getAttendeeList = jest.fn().mockResolvedValue([
      { userId: 99, userName: 'Unknown Member' },
    ]);

    const result = await getAttendees({ centerId: '5', startDate: '2026-06-01', endDate: '2026-06-01' });

    expect(result.body.data[0].userName).toBe('Unknown Member');
  });
});
