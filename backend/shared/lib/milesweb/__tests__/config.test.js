/**
 * Run: node --test backend/shared/lib/milesweb/__tests__/config.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isMileswebStorageEnabled, readMileswebConfig } from '../config.js';

const KEYS = [
  'MILESWEB_FTP_HOST',
  'MILESWEB_FTP_USER',
  'MILESWEB_FTP_PASSWORD',
  'MILESWEB_FTP_UPLOAD_ROOT',
];

describe('isMileswebStorageEnabled', () => {
  const prev = {};
  beforeEach(() => {
    KEYS.forEach((k) => { prev[k] = process.env[k]; });
  });
  afterEach(() => {
    KEYS.forEach((k) => {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    });
  });

  it('is off when host, user, or password is missing', () => {
    delete process.env.MILESWEB_FTP_HOST;
    delete process.env.MILESWEB_FTP_USER;
    delete process.env.MILESWEB_FTP_PASSWORD;
    assert.equal(isMileswebStorageEnabled(), false);
  });

  it('is off when only the host is set', () => {
    process.env.MILESWEB_FTP_HOST = 'spectrum.herosite.pro';
    delete process.env.MILESWEB_FTP_USER;
    delete process.env.MILESWEB_FTP_PASSWORD;
    assert.equal(isMileswebStorageEnabled(), false);
  });

  it('is on only when host, user, password, and upload root are set', () => {
    process.env.MILESWEB_FTP_HOST = 'spectrum.herosite.pro';
    process.env.MILESWEB_FTP_USER = 'ftp-user';
    process.env.MILESWEB_FTP_PASSWORD = 'ftp-pass';
    process.env.MILESWEB_FTP_UPLOAD_ROOT = 'wellnessvalley/uploads';
    assert.equal(isMileswebStorageEnabled(), true);
    assert.equal(readMileswebConfig().uploadRoot, 'wellnessvalley/uploads');
  });

  it('keeps "." as the FTP account home', () => {
    process.env.MILESWEB_FTP_HOST = 'spectrum.herosite.pro';
    process.env.MILESWEB_FTP_USER = 'ftp-user';
    process.env.MILESWEB_FTP_PASSWORD = 'ftp-pass';
    process.env.MILESWEB_FTP_UPLOAD_ROOT = '.';
    assert.equal(isMileswebStorageEnabled(), true);
    assert.equal(readMileswebConfig().uploadRoot, '.');
  });
});
