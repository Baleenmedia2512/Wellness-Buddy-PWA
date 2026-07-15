import {
  buildOnboardingShareUrl,
  buildShareCaptionForImage,
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

  describe('buildShareCaptionForImage', () => {
    it('includes member first name and host-only app path (no https)', () => {
      const text = buildShareCaptionForImage(
        'Priya Sharma',
        'https://api.example.com/app',
      );
      expect(text).toContain('Priya');
      expect(text).toContain('api.example.com/app');
      expect(text).not.toContain('https://');
    });
  });

  describe('getStoreLink', () => {
    it('maps android and ios to store URLs', () => {
      expect(getStoreLink('android')).toBe(STORE_LINKS.android);
      expect(getStoreLink('ios')).toBe(STORE_LINKS.ios);
    });
  });
});
