/**
 * Tests for the PR-E / ADR-0003 unknown-capture share viewer:
 *   - diary.service.js :: resolveUnknownShare
 *   - analysis.validators.js :: validateResolveUnknownShare
 *
 * Mocks the captures service (findByToken) and the analysis repository
 * (getCoachChain) at the module boundary. The retry permission policy runs
 * for real so a regression in the owner/coach gate is caught here.
 */

import * as service from '../diary.service.js';
import { validateResolveUnknownShare } from '../analysis.validators.js';

jest.mock('../../captures/captures.service.js', () => ({
  findByToken: jest.fn(),
}));

jest.mock('../analysis.repository.js', () => ({
  getCoachChain: jest.fn(),
}));

jest.mock('../../../shared/lib/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import * as captures from '../../captures/captures.service.js';
import * as repo from '../analysis.repository.js';

const TOKEN  = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const OWNER  = '42';
const COACH  = '99';
const STRANGER = '500';

const unknownRow = (over = {}) => ({
  ID: 7,
  UserID: OWNER,
  ImageType: 'unknown',
  ImageBase64: 'b64-bytes',
  CreatedAt: '2026-06-05T10:00:00.000Z',
  ShareExpiresAt: null,
  IsDeleted: 0,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  repo.getCoachChain.mockResolvedValue([OWNER]); // owner-only chain by default
});

describe('resolveUnknownShare — lookup failures', () => {
  it('404s when the capture is missing', async () => {
    captures.findByToken.mockResolvedValue(null);
    const out = await service.resolveUnknownShare({ token: TOKEN, viewerUserId: OWNER });
    expect(out.httpStatus).toBe(404);
    expect(out.body.error.code).toBe('NOT_FOUND');
  });

  it('404s when the capture is soft-deleted', async () => {
    captures.findByToken.mockResolvedValue(unknownRow({ IsDeleted: 1 }));
    const out = await service.resolveUnknownShare({ token: TOKEN, viewerUserId: OWNER });
    expect(out.httpStatus).toBe(404);
  });

  it('410s when the share window has expired', async () => {
    captures.findByToken.mockResolvedValue(
      unknownRow({ ShareExpiresAt: '2000-01-01T00:00:00.000Z' }),
    );
    const out = await service.resolveUnknownShare({ token: TOKEN, viewerUserId: OWNER });
    expect(out.httpStatus).toBe(410);
    expect(out.body.error.code).toBe('EXPIRED');
  });

  it('409s when the capture is already classified (not unknown)', async () => {
    captures.findByToken.mockResolvedValue(unknownRow({ ImageType: 'food' }));
    const out = await service.resolveUnknownShare({ token: TOKEN, viewerUserId: OWNER });
    expect(out.httpStatus).toBe(409);
    expect(out.body.error.code).toBe('NOT_UNKNOWN');
    expect(out.body.error.currentType).toBe('food');
  });
});

describe('resolveUnknownShare — canMutate gating', () => {
  it('returns the image with canMutate:false for an anonymous viewer', async () => {
    captures.findByToken.mockResolvedValue(unknownRow());
    const out = await service.resolveUnknownShare({ token: TOKEN, viewerUserId: null });
    expect(out.httpStatus).toBe(200);
    expect(out.body.data.kind).toBe('unknown');
    expect(out.body.data.imageBase64).toBe('b64-bytes');
    expect(out.body.data.canMutate).toBe(false);
    // No coach-chain lookup for anonymous viewers.
    expect(repo.getCoachChain).not.toHaveBeenCalled();
  });

  it('grants canMutate:true to the OWNER', async () => {
    captures.findByToken.mockResolvedValue(unknownRow());
    const out = await service.resolveUnknownShare({ token: TOKEN, viewerUserId: OWNER });
    expect(out.httpStatus).toBe(200);
    expect(out.body.data.canMutate).toBe(true);
  });

  it('grants canMutate:true to a coach in the owner upline', async () => {
    repo.getCoachChain.mockResolvedValue([OWNER, COACH]);
    captures.findByToken.mockResolvedValue(unknownRow());
    const out = await service.resolveUnknownShare({ token: TOKEN, viewerUserId: COACH });
    expect(out.body.data.canMutate).toBe(true);
  });

  it('denies canMutate to an authenticated stranger', async () => {
    repo.getCoachChain.mockResolvedValue([OWNER, COACH]);
    captures.findByToken.mockResolvedValue(unknownRow());
    const out = await service.resolveUnknownShare({ token: TOKEN, viewerUserId: STRANGER });
    expect(out.body.data.canMutate).toBe(false);
  });
});

describe('validateResolveUnknownShare', () => {
  it('accepts a valid token without a viewer (anonymous allowed)', () => {
    const out = validateResolveUnknownShare({ token: TOKEN });
    expect(out).toEqual({ token: TOKEN, viewerUserId: null });
  });

  it('passes viewerUserId through as a string', () => {
    const out = validateResolveUnknownShare({ token: TOKEN, viewerUserId: 42 });
    expect(out.viewerUserId).toBe('42');
  });

  it('rejects a missing token', () => {
    expect(() => validateResolveUnknownShare({})).toThrow(/token is required/);
  });

  it('rejects a non-UUID token', () => {
    expect(() => validateResolveUnknownShare({ token: 'not-a-uuid' })).toThrow(/Invalid token format/);
  });
});
