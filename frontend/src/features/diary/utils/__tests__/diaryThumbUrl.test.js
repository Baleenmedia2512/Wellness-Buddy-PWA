/**
 * Run: node --test frontend/src/features/diary/utils/__tests__/diaryThumbUrl.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchDiaryShareImageSrc,
  fetchRemoteImageAsDataUrl,
  resolveDiaryThumbSource,
} from '../diaryThumbUrl.js';

function blobFrom(text, type = 'image/jpeg') {
  return {
    size: text.length,
    type,
    arrayBuffer: async () => Buffer.from(text, 'utf8'),
  };
}

describe('resolveDiaryThumbSource', () => {
  it('builds a raw meal-image URL for food entries', () => {
    const src = resolveDiaryThumbSource(
      { kind: 'food', payload: { id: 9 } },
      { ownerUserId: 1, apiBaseUrl: 'https://api.example' },
    );
    assert.equal(src.format, 'raw');
    assert.match(String(src.src || ''), /meal-image/);
  });
});

describe('fetchRemoteImageAsDataUrl', () => {
  it('returns data URIs unchanged', async () => {
    const data = 'data:image/jpeg;base64,abc';
    assert.equal(await fetchRemoteImageAsDataUrl(data), data);
  });

  it('returns local template paths unchanged', async () => {
    assert.equal(await fetchRemoteImageAsDataUrl('/emoji/1f37d.svg'), '/emoji/1f37d.svg');
  });

  it('converts a fetched remote image to a data URL', async () => {
    const out = await fetchRemoteImageAsDataUrl('https://cdn.example/a.jpg', {
      fetchImpl: async (url) => {
        assert.equal(url, 'https://cdn.example/a.jpg');
        return { ok: true, blob: async () => blobFrom('abc') };
      },
      httpGet: async () => ({ status: 500, data: null, headers: {} }),
    });
    assert.match(out, /^data:image\/jpeg;base64,/);
  });

  it('uses CapacitorHttp when provided (API→R2 path)', async () => {
    const out = await fetchRemoteImageAsDataUrl('https://api.example/meal-image?id=1', {
      fetchImpl: async () => ({ ok: false }),
      httpGet: async ({ url, responseType }) => {
        assert.equal(url, 'https://api.example/meal-image?id=1');
        assert.equal(responseType, 'blob');
        return {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
          data: Buffer.from('photo').toString('base64'),
        };
      },
    });
    assert.match(out, /^data:image\/jpeg;base64,/);
  });

  it('returns null when fetch and http both fail', async () => {
    const out = await fetchRemoteImageAsDataUrl('https://cdn.example/a.jpg', {
      fetchImpl: async () => ({ ok: false }),
      httpGet: async () => {
        throw new Error('offline');
      },
    });
    assert.equal(out, null);
  });
});

describe('fetchDiaryShareImageSrc', () => {
  it('inlines raw thumb URLs as data URLs for html2canvas', async () => {
    const out = await fetchDiaryShareImageSrc(
      {
        kind: 'food',
        imageUrl: 'https://api.example/api/food-corrections/meal-image?userId=1&id=9',
        imageUrlFormat: 'raw',
      },
      {
        fetchImpl: async () => ({ ok: true, blob: async () => blobFrom('photo') }),
        httpGet: async () => ({ status: 500, data: null, headers: {} }),
      },
    );
    assert.match(out, /^data:image\/jpeg;base64,/);
  });

  it('falls back to the activity template when the remote image cannot load', async () => {
    const out = await fetchDiaryShareImageSrc(
      {
        kind: 'food',
        imageUrl: 'https://api.example/missing',
        imageUrlFormat: 'raw',
      },
      {
        fetchImpl: async () => ({ ok: false }),
        httpGet: async () => {
          throw new Error('offline');
        },
      },
    );
    assert.match(out, /emoji|food|1f37d|\.svg/i);
  });
});
