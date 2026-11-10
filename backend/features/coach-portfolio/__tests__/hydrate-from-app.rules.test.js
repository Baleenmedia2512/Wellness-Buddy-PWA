/**
 * Run: node --test backend/features/coach-portfolio/__tests__/hydrate-from-app.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PORTFOLIO_OFFERINGS } from '../domain/default-offerings.rules.js';
import { hydratePortfolioFormFromApp } from '../domain/hydrate-from-app.rules.js';
import { emptyPortfolioForm } from '../domain/submission.rules.js';

describe('hydratePortfolioFormFromApp', () => {
  it('fills empty profile, club, contact, maps, place, and default offerings', () => {
    const form = hydratePortfolioFormFromApp(emptyPortfolioForm(), {
      userName: 'Demo Coach',
      phoneNumber: '9999999999',
      email: 'demo@example.com',
      avatarUrl: 'https://cdn.example/avatar.jpg',
      centerName: 'RS Puram Club',
      latitude: 11.0,
      longitude: 76.9,
      city: 'Coimbatore',
      locality: 'RS Puram',
    });
    assert.equal(form.personal.fullName, 'Demo Coach');
    assert.equal(form.mediaBrand.websiteDisplayName, 'Demo Coach');
    assert.equal(form.personal.professionalTitle, 'Wellness Coach');
    assert.equal(form.personal.profilePhoto, 'https://cdn.example/avatar.jpg');
    assert.equal(form.center.businessPhone, '9999999999');
    assert.equal(form.center.whatsapp, '9999999999');
    assert.equal(form.center.centerName, 'RS Puram Club');
    assert.equal(form.center.mapsLink, 'https://maps.google.com/?q=11,76.9');
    assert.equal(form.center.city, 'Coimbatore');
    assert.equal(form.center.locality, 'RS Puram');
    assert.deepEqual(form.services.offerings, [...DEFAULT_PORTFOLIO_OFFERINGS]);
  });

  it('does not overwrite non-empty FormJson except name + photo + club place', () => {
    const form = hydratePortfolioFormFromApp({
      personal: { fullName: 'Existing', professionalTitle: 'Nutrition Coach', profilePhoto: 'keep-me' },
      center: {
        centerName: 'Old Center',
        businessPhone: '111',
        whatsapp: '222',
        mapsLink: 'https://maps.google.com/?q=1,1',
        city: 'Old City',
        locality: 'Old Area',
      },
      services: { offerings: ['Custom Offer'] },
      mediaBrand: { websiteDisplayName: 'Brand' },
    }, {
      userName: 'New Name',
      phoneNumber: '999',
      avatarUrl: 'https://cdn.example/new.jpg',
      centerName: 'New Club',
      latitude: 11,
      longitude: 76,
      city: 'Coimbatore',
      locality: 'Kodambakkam',
    });
    assert.equal(form.personal.fullName, 'New Name');
    assert.equal(form.personal.professionalTitle, 'Nutrition Coach');
    assert.equal(form.personal.profilePhoto, 'https://cdn.example/new.jpg');
    assert.equal(form.center.centerName, 'Old Center');
    assert.equal(form.center.businessPhone, '111');
    assert.equal(form.center.whatsapp, '222');
    assert.equal(form.center.mapsLink, 'https://maps.google.com/?q=1,1');
    assert.deepEqual(form.services.offerings, ['Custom Offer']);
    assert.equal(form.mediaBrand.websiteDisplayName, 'Brand');
    assert.equal(form.center.city, 'Coimbatore');
    assert.equal(form.center.locality, 'Kodambakkam');
  });
});
