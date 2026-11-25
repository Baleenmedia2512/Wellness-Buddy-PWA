import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeWhatsAppPhone,
  buildWhatsAppShareUrl,
  buildWhatsAppShareButtonHtml,
} from '../whatsapp-share.rules.js';

describe('whatsapp-share.rules', () => {
  describe('normalizeWhatsAppPhone', () => {
    it('normalises 10-digit Indian numbers with 91 prefix', () => {
      assert.strictEqual(normalizeWhatsAppPhone('9876543210'), '919876543210');
      assert.strictEqual(normalizeWhatsAppPhone('09876543210'), '919876543210');
      assert.strictEqual(normalizeWhatsAppPhone('+91 98765 43210'), '919876543210');
    });

    it('returns null for empty or invalid numbers', () => {
      assert.strictEqual(normalizeWhatsAppPhone(''), null);
      assert.strictEqual(normalizeWhatsAppPhone(null), null);
      assert.strictEqual(normalizeWhatsAppPhone('123'), null);
    });
  });

  describe('buildWhatsAppShareUrl', () => {
    it('generates wa.me link with phone and prefilled text', () => {
      const url = buildWhatsAppShareUrl({
        phone: '9876543210',
        text: 'Your verification code is 1234',
      });
      assert.strictEqual(
        url,
        'https://wa.me/919876543210?text=Your%20verification%20code%20is%201234',
      );
    });

    it('generates universal send link when phone is not provided', () => {
      const url = buildWhatsAppShareUrl({
        text: 'Your verification code is 1234',
      });
      assert.strictEqual(
        url,
        'https://api.whatsapp.com/send?text=Your%20verification%20code%20is%201234',
      );
    });
  });

  describe('buildWhatsAppShareButtonHtml', () => {
    it('generates HTML table button linking to shareUrl', () => {
      const html = buildWhatsAppShareButtonHtml({
        shareUrl: 'https://api.whatsapp.com/send?text=1234',
        label: 'Share on WhatsApp',
      });
      assert.ok(html.includes('https://api.whatsapp.com/send?text=1234'));
      assert.ok(html.includes('Share on WhatsApp'));
      assert.ok(html.includes('background-color:#16a34a'));
    });

    it('returns empty string when shareUrl is empty', () => {
      assert.strictEqual(buildWhatsAppShareButtonHtml({ shareUrl: '' }), '');
    });
  });
});

