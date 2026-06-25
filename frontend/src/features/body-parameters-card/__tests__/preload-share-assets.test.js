import { preloadBodyParamsShareAssets, BODY_PARAMS_SHARE_ASSETS } from '../domain/preload-share-assets.js';

describe('preloadBodyParamsShareAssets', () => {
  it('preloads all body-params share card image assets', () => {
    const originalImage = global.Image;
    const created = [];

    global.Image = jest.fn(() => {
      const img = { src: '' };
      created.push(img);
      return img;
    });

    preloadBodyParamsShareAssets();

    expect(created).toHaveLength(BODY_PARAMS_SHARE_ASSETS.length);
    BODY_PARAMS_SHARE_ASSETS.forEach((src, index) => {
      expect(created[index].src).toBe(src);
    });

    global.Image = originalImage;
  });
});
