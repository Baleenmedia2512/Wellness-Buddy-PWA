/**
 * Run: node --test frontend/src/features/testimonials/__tests__/normalizeVideoUploadFile.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVideoUploadFile } from '../utils/normalizeVideoUploadFile.js';

describe('normalizeVideoUploadFile', () => {
  it('copies a zero-size-looking blob into a File with real bytes', async () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    const blob = new Blob([bytes], { type: 'video/mp4' });
    const file = new File([blob], 'clip.mp4', { type: 'video/mp4' });
    const normalized = await normalizeVideoUploadFile(file);
    assert.equal(normalized.name, 'clip.mp4');
    assert.equal(normalized.type, 'video/mp4');
    assert.ok(normalized.size > 0);
  });

  it('rejects a missing file', async () => {
    await assert.rejects(
      () => normalizeVideoUploadFile(null),
      /No video file selected/,
    );
  });
});
