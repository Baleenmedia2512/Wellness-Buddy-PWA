/**
 * Unit tests for captures.service.js.
 * Repository is mocked at the module boundary — these are pure unit tests.
 * Coverage target: ≥ 95 % lines / 90 % branches (claude.md §9.1).
 */
import * as service from '../captures.service.js';

jest.mock('../data/captures.repository.js', () => ({
  insertPending: jest.fn(),
  findByToken: jest.fn(),
  updateImageTypeByToken: jest.fn(),
}));

import * as repo from '../data/captures.repository.js';

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── recordPending ───────────────────────────────────────────────────────────

describe('recordPending', () => {
  const baseInput = {
    userId: '42',
    publicShareToken: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    shareExpiresAt: '2026-06-01T00:00:00.000Z',
    imageBase64: 'data:image/jpeg;base64,abc',
  };

  it('forwards to repo.insertPending and returns {id, publicShareToken}', async () => {
    repo.insertPending.mockResolvedValueOnce({ ID: 7, PublicShareToken: baseInput.publicShareToken });
    const out = await service.recordPending(baseInput);
    expect(repo.insertPending).toHaveBeenCalledWith(expect.objectContaining({
      userId: '42',
      publicShareToken: baseInput.publicShareToken,
      shareExpiresAt: baseInput.shareExpiresAt,
      imageBase64: baseInput.imageBase64,
    }));
    expect(out).toEqual({ id: 7, publicShareToken: baseInput.publicShareToken });
  });

  it('throws when userId missing', async () => {
    await expect(service.recordPending({ ...baseInput, userId: '' })).rejects.toThrow(/userId required/);
  });

  it('throws when publicShareToken missing', async () => {
    await expect(service.recordPending({ ...baseInput, publicShareToken: '' })).rejects.toThrow(/publicShareToken required/);
  });
});

// ─── updateType ──────────────────────────────────────────────────────────────

describe('updateType', () => {
  const token = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  it('promotes pending → food', async () => {
    repo.findByToken.mockResolvedValueOnce({ UserID: '42', ImageType: 'pending' });
    repo.updateImageTypeByToken.mockResolvedValueOnce({ ImageType: 'food' });
    const out = await service.updateType({ publicShareToken: token, userId: '42', toType: 'food' });
    expect(out).toEqual({ changed: true, imageType: 'food' });
    expect(repo.updateImageTypeByToken).toHaveBeenCalledWith({
      token, userId: '42', imageType: 'food',
    });
  });

  it.each(['weight', 'education', 'smartwatch', 'unknown'])(
    'promotes pending → %s', async (toType) => {
      repo.findByToken.mockResolvedValueOnce({ UserID: '42', ImageType: 'pending' });
      repo.updateImageTypeByToken.mockResolvedValueOnce({ ImageType: toType });
      const out = await service.updateType({ publicShareToken: token, userId: '42', toType });
      expect(out.changed).toBe(true);
      expect(out.imageType).toBe(toType);
    },
  );

  it('returns NOT_FOUND_OR_NOT_OWNER when token unknown', async () => {
    repo.findByToken.mockResolvedValueOnce(null);
    const out = await service.updateType({ publicShareToken: token, userId: '42', toType: 'food' });
    expect(out).toEqual({ changed: false, reason: 'NOT_FOUND_OR_NOT_OWNER' });
    expect(repo.updateImageTypeByToken).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND_OR_NOT_OWNER on wrong owner', async () => {
    repo.findByToken.mockResolvedValueOnce({ UserID: '99', ImageType: 'pending' });
    const out = await service.updateType({ publicShareToken: token, userId: '42', toType: 'food' });
    expect(out).toEqual({ changed: false, reason: 'NOT_FOUND_OR_NOT_OWNER' });
  });

  it('returns ALREADY_IN_TARGET_STATE on same-state no-op', async () => {
    repo.findByToken.mockResolvedValueOnce({ UserID: '42', ImageType: 'food' });
    const out = await service.updateType({ publicShareToken: token, userId: '42', toType: 'food' });
    expect(out).toEqual({ changed: false, reason: 'ALREADY_IN_TARGET_STATE' });
    expect(repo.updateImageTypeByToken).not.toHaveBeenCalled();
  });

  it('throws 409 on illegal transition (terminal → terminal)', async () => {
    repo.findByToken.mockResolvedValueOnce({ UserID: '42', ImageType: 'food' });
    await expect(
      service.updateType({ publicShareToken: token, userId: '42', toType: 'weight' }),
    ).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE_TRANSITION' });
  });

  it('throws 400 on invalid toType', async () => {
    await expect(
      service.updateType({ publicShareToken: token, userId: '42', toType: 'garbage' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repo.findByToken).not.toHaveBeenCalled();
  });

  it('returns UPDATE_RETURNED_NO_ROW when repo update no-ops', async () => {
    repo.findByToken.mockResolvedValueOnce({ UserID: '42', ImageType: 'pending' });
    repo.updateImageTypeByToken.mockResolvedValueOnce(null);
    const out = await service.updateType({ publicShareToken: token, userId: '42', toType: 'food' });
    expect(out).toEqual({ changed: false, reason: 'UPDATE_RETURNED_NO_ROW' });
  });
});
