import { buildShareCaption, buildShareTitle } from '../domain/share-caption.rules.js';

describe('share-caption.rules', () => {
  describe('buildShareCaption', () => {
    it('returns weight caption when imageType is weight', () => {
      const result = buildShareCaption({ imageType: 'weight' });
      expect(result).toContain('weight');
      expect(result).toContain('Wellness Valley');
    });

    it('includes viewUrl in caption when isBackground is true', () => {
      const result = buildShareCaption({
        imageType: 'food',
        viewUrl: 'https://example.com/s/abc',
        isBackground: true,
      });
      expect(result).toContain('https://example.com/s/abc');
      expect(result).toContain('nutrition');
    });

    it('returns plain food caption when isBackground is false and no viewUrl', () => {
      const result = buildShareCaption({ imageType: 'food', isBackground: false });
      expect(result).not.toContain('http');
      expect(result).toContain('Wellness Valley');
    });

    it('weight type takes priority over isBackground', () => {
      const result = buildShareCaption({
        imageType: 'weight',
        viewUrl: 'https://example.com/s/abc',
        isBackground: true,
      });
      expect(result).not.toContain('nutrition');
      expect(result).toContain('weight');
    });

    it('handles null imageType gracefully', () => {
      const result = buildShareCaption({ imageType: null });
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('buildShareTitle', () => {
    it('returns weight title for weight imageType', () => {
      const title = buildShareTitle({ imageType: 'weight' });
      expect(title).toContain('Weight');
    });

    it('returns meal/analysis title for food imageType', () => {
      const title = buildShareTitle({ imageType: 'food' });
      expect(typeof title).toBe('string');
      expect(title.length).toBeGreaterThan(0);
    });

    it('returns default title for unknown imageType', () => {
      const title = buildShareTitle({ imageType: null });
      expect(typeof title).toBe('string');
    });
  });
});
