/**
 * Run: node --test frontend/src/features/user/services/__tests__/imageCrop.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { imageSrcToDataUrl, coverCropOutputSize } from '../imageCrop.js';

const DATA_URI = 'data:image/jpeg;base64,SUIT';

function blobFrom(text, type = 'image/jpeg') {
  return {
    size: text.length,
    type,
    arrayBuffer: async () => Buffer.from(text, 'utf8'),
  };
}

describe('imageSrcToDataUrl', () => {
  it('returns data URIs without fetching', async () => {
    let fetched = false;
    const out = await imageSrcToDataUrl(DATA_URI, {
      fetchImpl: async () => {
        fetched = true;
        return { ok: false };
      },
    });
    assert.equal(out, DATA_URI);
    assert.equal(fetched, false);
  });

  it('converts a fetched image blob to a data URI', async () => {
    const out = await imageSrcToDataUrl('https://cdn.example/a.jpg', {
      fetchImpl: async (url) => {
        assert.equal(url, 'https://cdn.example/a.jpg');
        return { ok: true, blob: async () => blobFrom('abc') };
      },
    });
    assert.match(out, /^data:image\/jpeg;base64,/);
  });

  it('uses fallbackSrc when the display URL fails', async () => {
    const out = await imageSrcToDataUrl('https://cdn.example/blocked.jpg', {
      fallbackSrc: 'https://api.example/api/user/avatar?userId=1&inline=1',
      fetchImpl: async (url) => {
        if (url.includes('blocked')) return { ok: false };
        return { ok: true, blob: async () => blobFrom('xyz') };
      },
    });
    assert.match(out, /^data:image\/jpeg;base64,/);
  });

  it('rejects when src and fallback both fail', async () => {
    await assert.rejects(
      () => imageSrcToDataUrl('https://cdn.example/a.jpg', {
        fallbackSrc: 'https://api.example/inline',
        fetchImpl: async () => ({ ok: false }),
      }),
      /Failed to load image for crop/,
    );
  });
});

describe('coverCropOutputSize', () => {
  it('keeps 9:16 aspect and caps the long side', () => {
    const size = coverCropOutputSize(900, 1600, 1200);
    assert.equal(size.width, 675);
    assert.equal(size.height, 1200);
    assert.equal(size.width / size.height, 9 / 16);
  });

  it('does not upscale a smaller crop', () => {
    assert.deepEqual(coverCropOutputSize(90, 160, 1200), { width: 90, height: 160 });
  });
});
