import {
  validateCreateCapture,
  validatePublicToken,
} from '../validation/quick-share.validators.js';

const goodImage = 'data:image/jpeg;base64,' + 'A'.repeat(40);
const goodUuid = '550e8400-e29b-41d4-a716-446655440000';

describe('quick-share.validators – validateCreateCapture', () => {
  it('returns a normalised object on the happy path', () => {
    const out = validateCreateCapture({
      userId: 7, imageBase64: goodImage, clientNonce: goodUuid,
    });
    expect(out).toEqual({
      userId: '7', kind: 'food', imageBase64: goodImage, clientNonce: goodUuid,
    });
  });

  it('defaults kind to food when omitted', () => {
    const out = validateCreateCapture({ userId: '1', imageBase64: goodImage });
    expect(out.kind).toBe('food');
    expect(out.clientNonce).toBeNull();
  });

  it('rejects missing body', () => {
    expect(() => validateCreateCapture(null)).toThrow(/missing/);
  });

  it('rejects missing userId', () => {
    expect(() => validateCreateCapture({ imageBase64: goodImage })).toThrow(/userId/);
  });

  it("rejects non-'food' kind (phase 1)", () => {
    expect(() =>
      validateCreateCapture({ userId: '1', kind: 'weight', imageBase64: goodImage }),
    ).toThrow(/food/);
  });

  it('rejects non-data-URL imageBase64', () => {
    expect(() =>
      validateCreateCapture({ userId: '1', imageBase64: 'http://x/y.jpg' }),
    ).toThrow(/data:image/);
  });

  it('rejects oversize image', () => {
    const huge = 'data:image/jpeg;base64,' + 'B'.repeat(10 * 1024 * 1024);
    expect(() =>
      validateCreateCapture({ userId: '1', imageBase64: huge }),
    ).toThrow(/size/);
  });

  it('rejects non-UUID clientNonce', () => {
    expect(() =>
      validateCreateCapture({ userId: '1', imageBase64: goodImage, clientNonce: 'nope' }),
    ).toThrow(/UUID/);
  });
});

describe('quick-share.validators – validatePublicToken', () => {
  it('accepts a valid UUID', () => {
    expect(validatePublicToken({ token: goodUuid })).toEqual({ token: goodUuid });
  });

  it('rejects missing token', () => {
    expect(() => validatePublicToken({})).toThrow(/UUID/);
  });

  it('rejects non-UUID token', () => {
    expect(() => validatePublicToken({ token: '../../etc/passwd' })).toThrow(/UUID/);
  });
});
