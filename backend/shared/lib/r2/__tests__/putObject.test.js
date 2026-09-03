/**
 * Run: node --test backend/shared/lib/r2/__tests__/putObject.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readR2Config } from '../config.js';
import { putObject, deleteObject, parseListObjectsXml, listObjectKeys } from '../s3.js';

const SAMPLE_ENV = {
  R2_ACCOUNT_ID: 'acct123',
  R2_ACCESS_KEY_ID: 'AKIAEXAMPLE',
  R2_SECRET_ACCESS_KEY: 'secretsecretsecretsecret',
  R2_BUCKET: 'wv-media',
};

describe('putObject', () => {
  it('PUTs to the R2 endpoint with SigV4 headers', async () => {
    const config = readR2Config(SAMPLE_ENV);
    let captured;
    const fetchImpl = async (url, init) => {
      captured = { url, init };
      return { ok: true, status: 200, headers: { get: () => '"etag"' }, text: async () => '' };
    };
    const body = Buffer.from('jpeg-bytes');
    const result = await putObject({
      key: 'avatars/7/aa.jpg',
      body,
      contentType: 'image/jpeg',
      fetchImpl,
      config,
    });
    assert.equal(result.key, 'avatars/7/aa.jpg');
    assert.equal(captured.url, 'https://acct123.r2.cloudflarestorage.com/wv-media/avatars/7/aa.jpg');
    assert.equal(captured.init.method, 'PUT');
    assert.equal(captured.init.headers['content-type'], 'image/jpeg');
    assert.match(captured.init.headers.Authorization, /^AWS4-HMAC-SHA256 /);
    assert.equal(captured.init.body, body);
  });

  it('throws when R2 env is incomplete', async () => {
    await assert.rejects(
      () => putObject({
        key: 'avatars/7/aa.jpg',
        body: Buffer.from('x'),
        contentType: 'image/jpeg',
        config: readR2Config({}),
      }),
      /not configured/,
    );
  });
});

describe('deleteObject', () => {
  it('DELETEs the object URI', async () => {
    const config = readR2Config(SAMPLE_ENV);
    let captured;
    const fetchImpl = async (url, init) => {
      captured = { url, init };
      return { ok: true, status: 204, text: async () => '' };
    };
    const result = await deleteObject({
      key: 'avatars/7/old.jpg',
      fetchImpl,
      config,
    });
    assert.equal(result.key, 'avatars/7/old.jpg');
    assert.equal(captured.url, 'https://acct123.r2.cloudflarestorage.com/wv-media/avatars/7/old.jpg');
    assert.equal(captured.init.method, 'DELETE');
  });

  it('treats 404 as already deleted', async () => {
    const config = readR2Config(SAMPLE_ENV);
    const fetchImpl = async () => ({ ok: false, status: 404, text: async () => 'missing' });
    const result = await deleteObject({
      key: 'avatars/7/gone.jpg',
      fetchImpl,
      config,
    });
    assert.equal(result.deleted, false);
  });
});

describe('parseListObjectsXml', () => {
  it('reads keys and continuation token', () => {
    const parsed = parseListObjectsXml(`
      <ListBucketResult>
        <IsTruncated>true</IsTruncated>
        <NextContinuationToken>tok&amp;1</NextContinuationToken>
        <Contents><Key>avatars/1/a.jpg</Key></Contents>
        <Contents><Key>avatars/1/b.jpg</Key></Contents>
      </ListBucketResult>
    `);
    assert.deepEqual(parsed.keys, ['avatars/1/a.jpg', 'avatars/1/b.jpg']);
    assert.equal(parsed.isTruncated, true);
    assert.equal(parsed.nextContinuationToken, 'tok&1');
  });
});

describe('listObjectKeys', () => {
  it('GETs ListObjectsV2 under the prefix', async () => {
    const config = readR2Config(SAMPLE_ENV);
    let captured;
    const fetchImpl = async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        status: 200,
        text: async () => '<ListBucketResult><Contents><Key>avatars/1/a.jpg</Key></Contents></ListBucketResult>',
      };
    };
    const keys = await listObjectKeys({ prefix: 'avatars/', fetchImpl, config });
    assert.deepEqual(keys, ['avatars/1/a.jpg']);
    assert.equal(captured.init.method, 'GET');
    assert.match(captured.url, /list-type=2/);
    assert.match(captured.url, /prefix=avatars/);
  });
});
