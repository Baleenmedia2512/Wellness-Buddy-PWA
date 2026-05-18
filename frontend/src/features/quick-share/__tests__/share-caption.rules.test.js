import { buildShareCaption } from '../domain/share-caption.rules';

describe('quick-share buildShareCaption', () => {
  it('embeds the URL on the last line so WhatsApp auto-detects it', () => {
    const c = buildShareCaption('https://api.example.com/s/abc-123');
    expect(c).toContain('https://api.example.com/s/abc-123');
    expect(c.split('\n').pop()).toBe('https://api.example.com/s/abc-123');
  });

  it('returns empty string for missing url (caller sends image only)', () => {
    expect(buildShareCaption('')).toBe('');
    expect(buildShareCaption(null)).toBe('');
    expect(buildShareCaption(undefined)).toBe('');
  });

  it('rejects non-string input defensively', () => {
    expect(buildShareCaption(42)).toBe('');
    expect(buildShareCaption({})).toBe('');
  });
});
