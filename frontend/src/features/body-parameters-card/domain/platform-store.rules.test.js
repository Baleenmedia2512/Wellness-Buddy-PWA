import {
  buildOnboardingShareUrl,
  buildShareCaptionForImage,
  getStoreLink,
  STORE_LINKS,
} from './platform-store.rules.js';

describe('platform-store.rules', () => {
  describe('buildOnboardingShareUrl', () => {
    it('returns /share on the API host without tokens', () => {
      expect(buildOnboardingShareUrl('https://api.example.com/'))
        .toBe('https://api.example.com/share');
    });

    it('falls back to web landing when base is empty', () => {
      expect(buildOnboardingShareUrl('')).toBe(STORE_LINKS.web);
    });
  });

  describe('buildShareCaptionForImage', () => {
    it('includes member first name and host-only app path (no https)', () => {
      const text = buildShareCaptionForImage(
        'Priya Sharma',
        'https://api.example.com/share',
      );
      expect(text).toContain('Priya');
      expect(text).toContain('api.example.com/share');
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
