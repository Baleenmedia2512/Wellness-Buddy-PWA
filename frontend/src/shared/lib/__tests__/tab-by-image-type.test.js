import {
  TAB_BY_IMAGE_TYPE,
  tabForImageType,
  DEFAULT_TAB,
} from '../tab-by-image-type.js';

describe('TAB_BY_IMAGE_TYPE', () => {
  it('maps every supported image type', () => {
    expect(TAB_BY_IMAGE_TYPE.food).toBe('nutrition');
    expect(TAB_BY_IMAGE_TYPE.weight).toBe('weight');
    expect(TAB_BY_IMAGE_TYPE.education).toBe('education');
    expect(TAB_BY_IMAGE_TYPE.smartwatch).toBe('smartwatch');
    expect(TAB_BY_IMAGE_TYPE.unknown).toBe(DEFAULT_TAB);
    expect(TAB_BY_IMAGE_TYPE.pending).toBe(DEFAULT_TAB);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(TAB_BY_IMAGE_TYPE)).toBe(true);
  });
});

describe('tabForImageType()', () => {
  it.each([
    ['food', 'nutrition'],
    ['weight', 'weight'],
    ['education', 'education'],
    ['smartwatch', 'smartwatch'],
    ['unknown', DEFAULT_TAB],
    ['pending', DEFAULT_TAB],
  ])('%s -> %s', (type, expected) => {
    expect(tabForImageType(type)).toBe(expected);
  });

  it.each([null, undefined, '', 'garbage', 0, false])(
    'falls back to DEFAULT_TAB for invalid input: %p',
    (bad) => {
      expect(tabForImageType(bad)).toBe(DEFAULT_TAB);
    },
  );
});
