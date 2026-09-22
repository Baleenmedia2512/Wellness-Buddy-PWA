/**
 * Run: node --test backend/shared/lib/r2/__tests__/s3.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isR2Configured, readR2Config } from '../config.js';
import {
  publicObjectUrl,
  buildAvatarObjectKey,
  encodeObjectKey,
  buildSignedHeaders,
  signedGetObjectUrl,
} from '../s3.js';

const SAMPLE_ENV = {
  R2_ACCOUNT_ID: 'acct123',
  R2_ACCESS_KEY_ID: 'AKIAEXAMPLE',
  R2_SECRET_ACCESS_KEY: 'secretsecretsecretsecret',
  R2_BUCKET: 'wv-media',
  R2_PUBLIC_BASE_URL: 'https://media.example.com/',
};

describe('isR2Configured', () => {
  it('requires account, keys, and bucket', () => {
    assert.equal(isR2Configured({}), false);
    assert.equal(isR2Configured(SAMPLE_ENV), true);
    assert.equal(isR2Configured({ ...SAMPLE_ENV, R2_BUCKET: '' }), false);
  });
});

describe('publicObjectUrl', () => {
  it('joins public base and encoded key without a trailing slash on the origin', () => {
    const config = readR2Config(SAMPLE_ENV);
    assert.equal(
      publicObjectUrl('avatars/9/ab.jpg', config),
      'https://media.example.com/avatars/9/ab.jpg',
    );
  });
  it('returns null without a public base', () => {
    const config = readR2Config({ ...SAMPLE_ENV, R2_PUBLIC_BASE_URL: '' });
    assert.equal(publicObjectUrl('avatars/9/ab.jpg', config), null);
  });
});

describe('buildAvatarObjectKey', () => {
  it('namespaces by user id and hash', () => {
    assert.equal(buildAvatarObjectKey(42, 'abc123', 'jpg'), 'avatars/42/abc123.jpg');
  });
});

describe('encodeObjectKey', () => {
  it('encodes segments but keeps slashes', () => {
    assert.equal(encodeObjectKey('avatars/42/a b.jpg'), 'avatars/42/a%20b.jpg');
  });
});

describe('buildSignedHeaders', () => {
  it('produces AWS4 authorization for PUT', () => {
    const config = readR2Config(SAMPLE_ENV);
    const signed = buildSignedHeaders({
      method: 'PUT',
      key: 'avatars/1/x.jpg',
      body: Buffer.from('hi'),
      headers: { 'content-type': 'image/jpeg' },
      config,
      now: new Date('2026-09-03T10:00:00.000Z'),
    });
    assert.match(signed.authorization, /^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE\//);
    assert.match(signed.authorization, /SignedHeaders=/);
    assert.match(signed.authorization, /Signature=[0-9a-f]{64}$/);
    assert.equal(signed.uri, '/wv-media/avatars/1/x.jpg');
    assert.equal(signed.headerMap.host, 'acct123.r2.cloudflarestorage.com');
  });
});

describe('signedGetObjectUrl', () => {
  it('includes signature query params', () => {
    const config = readR2Config({ ...SAMPLE_ENV, R2_PUBLIC_BASE_URL: '' });
    const url = signedGetObjectUrl('avatars/1/x.jpg', {
      config,
      expiresSeconds: 60,
      now: new Date('2026-09-03T10:00:00.000Z'),
    });
    assert.ok(url.startsWith('https://acct123.r2.cloudflarestorage.com/wv-media/avatars/1/x.jpg?'));
    assert.ok(url.includes('X-Amz-Algorithm=AWS4-HMAC-SHA256'));
    assert.ok(url.includes('X-Amz-Signature='));
  });
});
