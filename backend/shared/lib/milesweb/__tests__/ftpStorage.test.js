/**
 * Run: node --test backend/shared/lib/milesweb/__tests__/ftpStorage.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  mileswebObjectExists,
  readMileswebObject,
  rememberMileswebObject,
  forgetMileswebObject,
} from '../ftpStorage.js';

const KEYS = [
  'MILESWEB_FTP_HOST',
  'MILESWEB_FTP_USER',
  'MILESWEB_FTP_PASSWORD',
];

describe('ftpStorage when MilesWeb FTP is off', () => {
  const prev = {};
  beforeEach(() => {
    KEYS.forEach((k) => { prev[k] = process.env[k]; });
    delete process.env.MILESWEB_FTP_HOST;
    delete process.env.MILESWEB_FTP_USER;
    delete process.env.MILESWEB_FTP_PASSWORD;
  });
  afterEach(() => {
    KEYS.forEach((k) => {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    });
  });

  it('does not open FTP for exists or read', async () => {
    forgetMileswebObject('avatars/1/a.jpg');
    rememberMileswebObject('avatars/1/a.jpg');
    assert.equal(await mileswebObjectExists('avatars/1/a.jpg'), false);
    assert.equal(await readMileswebObject('avatars/1/a.jpg'), null);
  });
});
