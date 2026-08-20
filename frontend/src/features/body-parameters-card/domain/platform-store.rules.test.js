/**
 * platform-store.rules.test.js
 * Run: node --test frontend/src/features/body-parameters-card/domain/platform-store.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOnboardingShareUrl,
  buildShareCaptionForImage,
  getStoreLink,
  STORE_LINKS,
} from './platform-store.rules.js';

describe('platform-store.rules', () => {
  describe('buildOnboardingShareUrl', () => {
    it('returns /share on the API host without tokens', () => {
      assert.equal(
        buildOnboardingShareUrl('https://api.example.com/'),
        'https://api.example.com/share',
      );
    });

    it('falls back to web landing when base is empty', () => {
      assert.equal(buildOnboardingShareUrl(''), STORE_LINKS.web);
    });
  });

  describe('buildShareCaptionForImage', () => {
    it('greets the member, names the coach, and includes venue without a share URL', () => {
      const text = buildShareCaptionForImage('ALI', 'Chromepet', 'YASHEER');
      assert.equal(
        text,
        [
          'Hi ALI, This is YASHEER.',
          '',
          "It was good to meet you at the fat camp in Chromepet. I'm enclosing your body composition metrics herewith.",
        ].join('\n'),
      );
      assert.equal(text.includes('/share'), false);
      assert.equal(text.includes('http'), false);
    });

    it('omits venue phrase when venue is empty', () => {
      const text = buildShareCaptionForImage('ALI', '', 'YASHEER');
      assert.ok(text.startsWith('Hi ALI, This is YASHEER.'));
      assert.ok(text.includes('at the fat camp.'));
      assert.equal(text.includes('fat camp in '), false);
    });

    it('falls back when name or coach is missing', () => {
      const text = buildShareCaptionForImage('', 'Chromepet', '');
      assert.ok(text.startsWith('Hi there, This is your coach.'));
    });
  });

  describe('getStoreLink', () => {
    it('maps android and ios to store URLs', () => {
      assert.equal(getStoreLink('android'), STORE_LINKS.android);
      assert.equal(getStoreLink('ios'), STORE_LINKS.ios);
    });
  });
});
