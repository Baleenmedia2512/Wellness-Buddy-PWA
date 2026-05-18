/**
 * frontend/src/features/quick-share/__tests__/captures.client.test.js
 *
 * Unit tests for the captures HTTP client. Pure fetch wrapping —
 * no React, no DOM.
 */
import { createCapture } from '../api/captures.client';

describe('captures.client.createCapture', () => {
  const ORIGINAL_FETCH = global.fetch;

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  test('POSTs to /api/quick-share/captures with JSON body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        token: 'abc-123',
        viewUrl: 'https://app.test/s/abc-123',
        expiresAt: '2026-06-17T00:00:00.000Z',
      }),
    });

    const out = await createCapture({
      userId: '42',
      imageBase64: 'data:image/jpeg;base64,AAAA',
      clientNonce: 'n1',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/quick-share\/captures$/);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      userId: '42',
      kind: 'food',
      imageBase64: 'data:image/jpeg;base64,AAAA',
      clientNonce: 'n1',
    });
    expect(out.token).toBe('abc-123');
    expect(out.viewUrl).toBe('https://app.test/s/abc-123');
  });

  test('throws Error with .status on non-OK response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 413,
      json: async () => ({ success: false, error: { message: 'Too large' } }),
    });

    await expect(
      createCapture({ userId: '1', imageBase64: 'data:image/jpeg;base64,AA' }),
    ).rejects.toMatchObject({ status: 413 });
  });

  test('propagates network errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(
      createCapture({ userId: '1', imageBase64: 'data:image/jpeg;base64,AA' }),
    ).rejects.toThrow('offline');
  });
});
