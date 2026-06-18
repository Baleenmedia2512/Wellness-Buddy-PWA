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
  it('includes full share URL with install prompt', () => {
    const url = 'https://example.com/share/bpc/abc-token';
    const text = buildShareText(url, 'test');
    expect(text).toBe(`Hey test! Install Wellness Valley app. Click the link\n${url}`);
  });

  it('uses first name only', () => {
    const text = buildShareText('https://x.com/share/bpc/t', 'Priya Sharma');
    expect(text).toContain('Hey Priya!');
    expect(text).not.toContain('Sharma');
  });

  it('handles no name gracefully', () => {
    const text = buildShareText('https://x.com/share/bpc/t', '');
    expect(text).toContain('Hey there!');
  });

  it('omits URL when shareUrl is null (native image share adds it separately)', () => {
    const text = buildShareText(null, 'Alex');
    expect(text).toBe('Hey Alex! Install Wellness Valley app. Click the link.');
    expect(text).not.toContain('http');
  });
});
