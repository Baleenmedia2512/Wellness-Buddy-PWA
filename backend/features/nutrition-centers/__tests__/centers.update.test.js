/**
 * Unit tests for the updateCenter service function.
 * Coverage target: ≥ 95 % lines / 90 % branches (claude.md §9.1).
 *
 * All I/O is mocked at the repository boundary — domain is pure.
 */
import { jest } from '@jest/globals';

// ── mock the repository module ────────────────────────────────────────────────
jest.mock('../centers.repository.js', () => ({
  findCenterOwner: jest.fn(),
  findUserRole: jest.fn(),
  findByName: jest.fn(),
  updateCenter: jest.fn(),
}));

import * as repo from '../centers.repository.js';
import { updateCenter } from '../centers.service.js';

const OWNER_ID = 10;
const CENTER_ID = 5;
const BASE_INPUT = {
  centerId: CENTER_ID,
  userId: OWNER_ID,
  centerName: 'Updated Name',
  latitude: 13.0,
  longitude: 80.0,
  ownerPhone: null,
  educationHour: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  repo.findCenterOwner.mockResolvedValue({ data: { owner_user_id: OWNER_ID }, error: null });
  repo.findUserRole.mockResolvedValue({ data: { Role: 'member' } });
  repo.findByName.mockResolvedValue({ data: null });
  repo.updateCenter.mockResolvedValue({ id: CENTER_ID, center_name: 'Updated Name' });
});

describe('updateCenter — permission guard', () => {
  it('returns 404 when center not found', async () => {
    repo.findCenterOwner.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const result = await updateCenter(BASE_INPUT);
    expect(result.httpStatus).toBe(404);
    expect(result.body.success).toBe(false);
  });

  it('returns 403 when non-owner non-admin calls update', async () => {
    repo.findCenterOwner.mockResolvedValue({ data: { owner_user_id: 99 }, error: null });
    const result = await updateCenter(BASE_INPUT);
    expect(result.httpStatus).toBe(403);
    expect(result.body.success).toBe(false);
  });

  it('allows admin (role=admin) to edit another owner\'s centre', async () => {
    repo.findCenterOwner.mockResolvedValue({ data: { owner_user_id: 99 }, error: null });
    repo.findUserRole.mockResolvedValue({ data: { Role: 'admin' } });
    const result = await updateCenter(BASE_INPUT);
    expect(result.httpStatus).toBe(200);
    expect(result.body.success).toBe(true);
  });
});

describe('updateCenter — name uniqueness', () => {
  it('rejects if name is taken by a DIFFERENT centre', async () => {
    repo.findByName.mockResolvedValue({ data: { id: 999 } });
    const result = await updateCenter(BASE_INPUT);
    expect(result.httpStatus).toBe(409);
    expect(result.body.duplicate).toBe(true);
  });

  it('allows keeping the same name (centre owns the name itself)', async () => {
    repo.findByName.mockResolvedValue({ data: { id: CENTER_ID } }); // same centre id
    const result = await updateCenter(BASE_INPUT);
    expect(result.httpStatus).toBe(200);
    expect(result.body.success).toBe(true);
  });
});

describe('updateCenter — happy path', () => {
  it('calls repo.updateCenter with correct payload and returns 200', async () => {
    const result = await updateCenter(BASE_INPUT);
    expect(result.httpStatus).toBe(200);
    expect(result.body.success).toBe(true);
    expect(repo.updateCenter).toHaveBeenCalledWith(
      CENTER_ID,
      expect.objectContaining({ center_name: 'Updated Name', latitude: 13.0, longitude: 80.0 }),
    );
  });

  it('does not include undefined fields in payload', async () => {
    const input = { centerId: CENTER_ID, userId: OWNER_ID, centerName: 'Only Name' };
    await updateCenter(input);
    const [, payload] = repo.updateCenter.mock.calls[0];
    expect(payload).not.toHaveProperty('latitude');
    expect(payload).not.toHaveProperty('longitude');
  });

  it('sets owner_phone to null when empty string passed', async () => {
    await updateCenter({ ...BASE_INPUT, ownerPhone: '' });
    const [, payload] = repo.updateCenter.mock.calls[0];
    expect(payload.owner_phone).toBeNull();
  });
});
