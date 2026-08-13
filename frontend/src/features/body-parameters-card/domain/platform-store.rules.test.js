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
    it('uses coach name and venue dynamically without a share URL', () => {
      const text = buildShareCaptionForImage('Rahul Sharma', 'Coimbatore');
      expect(text).toContain('Hi, this is Rahul.');
      expect(text).toContain('fat camp in Coimbatore');
      expect(text).toContain('body composition metrics here with');
      expect(text).not.toContain('/share');
      expect(text).not.toContain('http');
    });

    it('omits venue phrase when venue is empty', () => {
      const text = buildShareCaptionForImage('Yasheer', '');
      expect(text).toContain('Hi, this is Yasheer.');
      expect(text).toContain('at the fat camp.');
      expect(text).not.toContain('fat camp in ');
    });
  });

  describe('getStoreLink', () => {
    it('maps android and ios to store URLs', () => {
      expect(getStoreLink('android')).toBe(STORE_LINKS.android);
      expect(getStoreLink('ios')).toBe(STORE_LINKS.ios);
    });
  });
});
