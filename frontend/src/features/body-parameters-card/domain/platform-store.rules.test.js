import {
  buildOnboardingShareUrl,
  buildShareText,
  getStoreLink,
  STORE_LINKS,
} from './platform-store.rules.js';

describe('platform-store.rules', () => {
  describe('buildOnboardingShareUrl', () => {
    it('returns /app on the API host without tokens', () => {
      expect(buildOnboardingShareUrl('https://api.example.com/'))
        .toBe('https://api.example.com/app');
    });

    it('falls back to web landing when base is empty', () => {
      expect(buildOnboardingShareUrl('')).toBe(STORE_LINKS.web);
    });
  });

  describe('buildShareText', () => {
    it('includes the generic link and member first name', () => {
      const text = buildShareText('https://api.example.com/app', 'Priya Sharma');
      expect(text).toContain('Priya');
      expect(text).toContain('https://api.example.com/app');
      expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    });
  });

  describe('getStoreLink', () => {
    it('maps android and ios to store URLs', () => {
      expect(getStoreLink('android')).toBe(STORE_LINKS.android);
      expect(getStoreLink('ios')).toBe(STORE_LINKS.ios);
    });
  });
});
