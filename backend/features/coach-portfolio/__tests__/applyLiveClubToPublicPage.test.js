/**
 * Run: node --test backend/features/coach-portfolio/__tests__/applyLiveClubToPublicPage.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyLiveClubToPublicPage } from '../domain/applyLiveClubToPublicPage.js';

function basePage() {
  return {
    centerName: 'Form Name',
    entrancePhoto: 'https://old.example/entrance.jpg',
    interiorPhotos: ['https://old.example/interior.jpg'],
    nameBoardPhoto: 'https://old.example/board.jpg',
    activityPhotos: ['https://old.example/act.jpg'],
    workingDays: ['Wednesday'],
    openingTime: '09:00 AM',
    closingTime: '05:00 PM',
    phone: '9000000000',
    whatsapp: '9000000000',
  };
}

describe('applyLiveClubToPublicPage', () => {
  it('leaves freestyle / no-club pages unchanged', () => {
    const page = basePage();
    const before = structuredClone(page);
    applyLiveClubToPublicPage(page, null);
    assert.deepEqual(page, before);
    applyLiveClubToPublicPage(page, { hasClub: false });
    assert.deepEqual(page, before);
  });

  it('overlays live club photos, hours, and phone', () => {
    const page = basePage();
    applyLiveClubToPublicPage(page, {
      hasClub: true,
      centerName: 'Live Club',
      ownerPhone: '+919876543210',
      openingHours: {
        monday: { closed: false, slots: [{ open: '05:30', close: '21:30' }] },
        tuesday: { closed: false, slots: [{ open: '05:30', close: '21:30' }] },
        sunday: { closed: true, slots: [] },
      },
      photos: {
        entrance: ['https://cdn.example/e1.jpg'],
        interior: ['https://cdn.example/i1.jpg', 'https://cdn.example/i2.jpg'],
        name_board: ['https://cdn.example/n1.jpg'],
        wellness_activity: ['https://cdn.example/a1.jpg'],
      },
    });

    assert.equal(page.entrancePhoto, 'https://cdn.example/e1.jpg');
    assert.deepEqual(page.interiorPhotos, [
      'https://cdn.example/i1.jpg',
      'https://cdn.example/i2.jpg',
    ]);
    assert.equal(page.nameBoardPhoto, 'https://cdn.example/n1.jpg');
    assert.deepEqual(page.activityPhotos, ['https://cdn.example/a1.jpg']);
    assert.deepEqual(page.workingDays, ['Monday', 'Tuesday']);
    assert.equal(page.openingTime, '05:30 AM');
    assert.equal(page.closingTime, '09:30 PM');
    assert.equal(page.phone, '+919876543210');
    assert.equal(page.whatsapp, '919876543210');
  });

  it('clears stale FormJson media when club has no photos', () => {
    const page = basePage();
    applyLiveClubToPublicPage(page, {
      hasClub: true,
      openingHours: null,
      photos: {
        entrance: [],
        interior: [],
        name_board: [],
        wellness_activity: [],
      },
    });
    assert.equal(page.entrancePhoto, null);
    assert.deepEqual(page.interiorPhotos, []);
    assert.equal(page.nameBoardPhoto, null);
    assert.deepEqual(page.activityPhotos, []);
    assert.deepEqual(page.workingDays, []);
    assert.equal(page.openingTime, '');
    assert.equal(page.closingTime, '');
  });
});
