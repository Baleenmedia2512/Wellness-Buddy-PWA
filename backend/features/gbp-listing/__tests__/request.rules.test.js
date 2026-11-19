/**
 * Run: node --test backend/features/gbp-listing/__tests__/request.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GBP_PRIMARY_CATEGORIES,
  GBP_STATUS,
  canCoachEditRequest,
  canCoachSubmitRequest,
  countPhotos,
  mediaFolderKeyFor,
  normalizeGbpFormFields,
  normalizeMediaFiles,
  toPublicGbpRequest,
  validateGbpRequestForSubmit,
} from '../domain/request.rules.js';
import { buildGbpOpsEmail, parseOpsEmailList } from '../domain/opsEmail.rules.js';

describe('gbp-listing request.rules', () => {
  it('allows coach edit only on draft and needs_info', () => {
    assert.equal(canCoachEditRequest(GBP_STATUS.DRAFT), true);
    assert.equal(canCoachEditRequest(GBP_STATUS.NEEDS_INFO), true);
    assert.equal(canCoachSubmitRequest(GBP_STATUS.SUBMITTED), false);
    assert.equal(canCoachEditRequest(GBP_STATUS.LIVE), false);
  });

  it('validates submit requires NAP fields and min photos', () => {
    const errors = validateGbpRequestForSubmit({
      businessName: 'Valley Center',
      primaryCategory: GBP_PRIMARY_CATEGORIES[0],
      centerId: 12,
      streetAddress: '1 Main St',
      city: 'Chennai',
      state: 'Tamil Nadu',
      phone: '9876543210',
      mediaFiles: [
        { key: 'gbp-requests/1/1/a.jpg', kind: 'photo' },
        { key: 'gbp-requests/1/1/b.jpg', kind: 'photo' },
      ],
    });
    assert.ok(errors.some((e) => /3 photos/i.test(e)));

    const ok = validateGbpRequestForSubmit({
      businessName: 'Valley Center',
      primaryCategory: GBP_PRIMARY_CATEGORIES[2],
      centerId: 12,
      streetAddress: '1 Main St',
      city: 'Chennai',
      state: 'Tamil Nadu',
      phone: '9876543210',
      mediaFiles: [
        { key: 'a.jpg', kind: 'photo' },
        { key: 'b.jpg', kind: 'photo' },
        { key: 'c.jpg', kind: 'photo' },
        { key: 'd.mp4', kind: 'video' },
      ],
    });
    assert.deepEqual(ok, []);
  });

  it('normalizes form fields and media list', () => {
    const fields = normalizeGbpFormFields({
      businessName: '  Demo  ',
      phone: '98-765-43210',
      showAddress: '0',
      workingDays: ['Monday', 'Monday', 'Friday', 'Nope'],
      description: 'x'.repeat(600),
    });
    assert.equal(fields.businessName, 'Demo');
    assert.equal(fields.phone, '9876543210');
    assert.equal(fields.showAddress, false);
    assert.deepEqual(fields.workingDays, ['Monday', 'Friday']);
    assert.equal(fields.description.length, 500);

    const media = normalizeMediaFiles([
      { key: 'gbp-requests/1/2/x.jpg', url: '/u', kind: 'photo', bytes: 10 },
      { key: '', kind: 'photo' },
    ]);
    assert.equal(media.length, 1);
    assert.equal(countPhotos(media), 1);
    assert.equal(mediaFolderKeyFor({ userId: 9, requestId: 3 }), 'gbp-requests/9/3');
  });

  it('builds public payload and ops email helpers', () => {
    const pub = toPublicGbpRequest({
      id: 5,
      userId: 9,
      centerId: 2,
      status: GBP_STATUS.DRAFT,
      businessName: 'Demo Centre',
      mediaFilesJson: JSON.stringify([
        { key: 'gbp-requests/9/5/a.jpg', kind: 'photo' },
      ]),
      workingDaysJson: JSON.stringify(['Tuesday']),
      showAddress: 1,
    });
    assert.equal(pub.id, 5);
    assert.equal(pub.canEdit, true);
    assert.equal(pub.photoCount, 1);
    assert.deepEqual(pub.workingDays, ['Tuesday']);

    const mail = buildGbpOpsEmail({
      id: 5,
      businessName: 'Demo Centre',
      city: 'Chennai',
      userId: 9,
      mediaFolderKey: 'gbp-requests/9/5',
      mediaFiles: pub.mediaFiles,
      photoCount: 1,
    });
    assert.match(mail.subject, /GBP request #5/);
    assert.match(mail.text, /Demo Centre/);
    assert.deepEqual(parseOpsEmailList('a@x.com, b@y.com ,bad'), ['a@x.com', 'b@y.com']);
  });
});
