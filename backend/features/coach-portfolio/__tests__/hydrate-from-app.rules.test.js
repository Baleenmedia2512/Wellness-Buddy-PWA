/**
 * Run: node --test backend/features/coach-portfolio/__tests__/hydrate-from-app.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PORTFOLIO_OFFERINGS } from '../domain/default-offerings.rules.js';
import {
  hydratePortfolioFormFromApp,
  yearsExperienceFromJoinedOn,
} from '../domain/hydrate-from-app.rules.js';
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
    assert.equal(form.personal.professionalTitle, '');
    assert.equal(form.personal.profilePhoto, 'https://cdn.example/avatar.jpg');
    assert.equal(form.center.businessPhone, '9999999999');
    assert.equal(form.center.whatsapp, '9999999999');
    assert.equal(form.center.centerName, 'RS Puram Club');
    assert.equal(form.center.mapsLink, 'https://maps.google.com/?q=11,76.9');
    assert.equal(form.center.city, 'Coimbatore');
    assert.equal(form.center.locality, 'RS Puram');
    assert.deepEqual(form.services.offerings, [...DEFAULT_PORTFOLIO_OFFERINGS]);
  });

  it('does not overwrite non-empty FormJson except name + photo + club place + Profile intro', () => {
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
    // Empty Profile title clears stale FormJson title (e.g. old Wellness Coach default).
    assert.equal(form.personal.professionalTitle, '');
    assert.equal(form.personal.profilePhoto, 'https://cdn.example/new.jpg');
    // Linked club name always follows the live club.
    assert.equal(form.center.centerName, 'New Club');
    assert.equal(form.center.businessPhone, '111');
    assert.equal(form.center.whatsapp, '222');
    assert.equal(form.center.mapsLink, 'https://maps.google.com/?q=1,1');
    assert.deepEqual(form.services.offerings, ['Custom Offer']);
    assert.equal(form.mediaBrand.websiteDisplayName, 'Brand');
    // Saved place is kept — club GPS must not overwrite a map pick.
    assert.equal(form.center.city, 'Old City');
    assert.equal(form.center.locality, 'Old Area');
  });

  it('fills blank city/area from club GPS hydrate', () => {
    const form = hydratePortfolioFormFromApp({
      personal: { fullName: 'Demo' },
      center: { city: '', locality: '' },
    }, {
      city: 'Coimbatore',
      locality: 'Kodambakkam',
    });
    assert.equal(form.center.city, 'Coimbatore');
    assert.equal(form.center.locality, 'Kodambakkam');
  });

  it('clears stale Wellness Coach title when Profile professional title is empty', () => {
    const form = hydratePortfolioFormFromApp({
      personal: { fullName: 'Developer', professionalTitle: 'Wellness Coach' },
    }, {
      userName: 'Developer',
      professionalTitle: '',
    });
    assert.equal(form.personal.professionalTitle, '');
  });

  it('maps Profile intro into FormJson and years from joining date', () => {
    const form = hydratePortfolioFormFromApp(emptyPortfolioForm(), {
      userName: 'Demo Coach',
      professionalTitle: 'Nutrition Coach',
      aboutMe: 'I help families eat better.',
      qualification: 'Certified coach',
      herbalifeJoinedOn: '15/01/2020',
      languages: ['en', 'ta'],
      instagram: 'https://instagram.com/demo',
      youtube: 'https://youtube.com/@demo',
      linkedin: 'https://linkedin.com/in/demo',
    });
    assert.equal(form.personal.professionalTitle, 'Nutrition Coach');
    assert.equal(form.personal.background, 'I help families eat better.');
    assert.equal(form.personal.qualifications, 'Certified coach');
    assert.equal(form.personal.yearsExperience, yearsExperienceFromJoinedOn('15/01/2020'));
    assert.deepEqual(form.personal.languages, ['English', 'Tamil']);
    assert.equal(form.mediaBrand.social.instagram, 'https://instagram.com/demo');
    assert.equal(form.mediaBrand.social.youtube, 'https://youtube.com/@demo');
    assert.equal(form.mediaBrand.social.linkedin, 'https://linkedin.com/in/demo');
  });

  it('formats years of experience from joining date', () => {
    assert.equal(
      yearsExperienceFromJoinedOn('01/01/2020', new Date('2026-06-01T00:00:00.000Z')),
      '6+ years',
    );
    assert.equal(
      yearsExperienceFromJoinedOn('01/12/2025', new Date('2026-06-01T00:00:00.000Z')),
      'Less than 1 year',
    );
  });
});
