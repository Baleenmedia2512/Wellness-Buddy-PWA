/**
 * platform-store.rules.test.js
 */
import { getStoreLink, buildShareText, STORE_LINKS } from '../domain/platform-store.rules.js';

describe('getStoreLink', () => {
  it('returns android store for android platform', () => {
    expect(getStoreLink('android')).toBe(STORE_LINKS.android);
  });

  it('returns ios store for ios platform', () => {
    expect(getStoreLink('ios')).toBe(STORE_LINKS.ios);
  });

  it('returns web landing for web platform', () => {
    expect(getStoreLink('web')).toBe(STORE_LINKS.web);
  });

  it('falls back to web for unknown platform', () => {
    expect(getStoreLink('unknown')).toBe(STORE_LINKS.web);
  });
});

describe('buildShareText', () => {
  it('shows clean base URL without BPC token', () => {
    const text = buildShareText('https://example.com/share/bpc/abc', 'Ali Hassan');
    expect(text).toContain('https://example.com/share');
    expect(text).not.toContain('/bpc/abc');
  });

  it('uses first name only', () => {
    const text = buildShareText('https://x.com', 'Priya Sharma');
    expect(text).toContain('Priya');
    expect(text).not.toContain('Sharma');
  });

  it('handles no name gracefully', () => {
    const text = buildShareText('https://x.com', '');
    expect(text).toContain('you');
  });
});
