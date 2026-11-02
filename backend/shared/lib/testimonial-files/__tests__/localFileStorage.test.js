import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  createLocalFileStorage,
  verifyTestimonialFileRequest,
  testimonialFileUrl,
} from '../localFileStorage.js';

describe('local testimonial files', () => {
  it('rejects paths that leave the user folder', () => {
    const storage = createLocalFileStorage();
    return storage.from().upload('../secret.txt', Buffer.from('no')).then((result) => {
      assert.equal(result.error.message, 'Invalid testimonial file path');
    });
  });

  it('writes a photo and signs a URL that verifies', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wv-files-'));
    const env = { ...process.env, TESTIMONIAL_FILE_DIR: dir, CRON_SECRET: 'test-secret' };
    const storage = createLocalFileStorage(env);
    const uploaded = await storage.from().upload('339/before_1.jpg', Buffer.from('jpeg'));
    assert.equal(uploaded.error, null);
    const saved = await fs.readFile(path.join(dir, '339', 'before_1.jpg'), 'utf8');
    assert.equal(saved, 'jpeg');

    const url = new URL(testimonialFileUrl('339/before_1.jpg', 60, env));
    assert.equal(
      verifyTestimonialFileRequest('339/before_1.jpg', Number(url.searchParams.get('exp')), url.searchParams.get('sig'), env),
      true,
    );
  });
});
