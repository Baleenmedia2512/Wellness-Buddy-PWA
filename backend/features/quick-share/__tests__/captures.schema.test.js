import { validateCreateCapture, validatePublicToken } from '../validation/captures.schema.js';

describe('captures.schema', () => {
  describe('validateCreateCapture', () => {
    const valid = {
      imageBase64: 'data:image/jpeg;base64,/9j/4AAQ',
      mimeType: 'image/jpeg',
      userId: '42',
    };

    it('accepts valid input', () => {
      expect(validateCreateCapture(valid)).toEqual({ ok: true });
    });

    it('rejects missing body', () => {
      expect(validateCreateCapture(null).ok).toBe(false);
    });

    it('rejects missing imageBase64', () => {
      const { imageBase64: _, ...rest } = valid;
      expect(validateCreateCapture(rest).ok).toBe(false);
    });

    it('rejects imageBase64 that is too large', () => {
      const oversized = { ...valid, imageBase64: 'x'.repeat(8 * 1024 * 1024 + 1) };
      expect(validateCreateCapture(oversized).ok).toBe(false);
    });

    it('rejects unsupported mimeType', () => {
      expect(validateCreateCapture({ ...valid, mimeType: 'image/gif' }).ok).toBe(false);
    });

    it('rejects missing userId', () => {
      const { userId: _, ...rest } = valid;
      expect(validateCreateCapture(rest).ok).toBe(false);
    });
  });

  describe('validatePublicToken', () => {
    it('accepts a 10-char alphanumeric token', () => {
      expect(validatePublicToken('AbCdEf1234')).toEqual({ ok: true });
    });

    it('rejects a token with special characters', () => {
      expect(validatePublicToken('abc!@#$%^&').ok).toBe(false);
    });

    it('rejects an empty string', () => {
      expect(validatePublicToken('').ok).toBe(false);
    });

    it('rejects a non-string', () => {
      expect(validatePublicToken(null).ok).toBe(false);
      expect(validatePublicToken(12345).ok).toBe(false);
    });

    it('rejects a token shorter than 6 chars', () => {
      expect(validatePublicToken('abc').ok).toBe(false);
    });

    it('rejects a token longer than 20 chars', () => {
      expect(validatePublicToken('a'.repeat(21)).ok).toBe(false);
    });
  });
});
