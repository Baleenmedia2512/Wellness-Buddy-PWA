/**
 * Run: node --test frontend/src/features/coach-portfolio/domain/applyProfileIntro.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyProfileIntroToForm,
  isLegacyDefaultProfessionalTitle,
  yearsExperienceFromJoinedOn,
} from './applyProfileIntro.js';

describe('applyProfileIntro', () => {
  it('treats Wellness Coach as a legacy default title', () => {
    assert.equal(isLegacyDefaultProfessionalTitle('Wellness Coach'), true);
    assert.equal(isLegacyDefaultProfessionalTitle('Nutrition Coach'), false);
  });

  it('clears stale title when Profile professional title is empty', () => {
    const form = {
      personal: { professionalTitle: 'Wellness Coach', background: 'old', yearsExperience: '5+ years' },
      mediaBrand: { social: {} },
    };
    applyProfileIntroToForm(form, { professionalTitle: '', aboutMe: '', herbalifeJoinedOn: '' });
    assert.equal(form.personal.professionalTitle, '');
    assert.equal(form.personal.background, '');
    assert.equal(form.personal.yearsExperience, '');
  });

  it('copies Profile title and years from joining date', () => {
    const form = {
      personal: { professionalTitle: '', background: '', yearsExperience: '' },
      mediaBrand: { social: {} },
    };
    applyProfileIntroToForm(form, {
      professionalTitle: 'Nutrition Coach',
      aboutMe: 'Hello',
      herbalifeJoinedOn: '01/01/2020',
      languages: ['en', 'ta'],
    });
    assert.equal(form.personal.professionalTitle, 'Nutrition Coach');
    assert.equal(form.personal.background, 'Hello');
    assert.equal(
      form.personal.yearsExperience,
      yearsExperienceFromJoinedOn('01/01/2020'),
    );
    assert.deepEqual(form.personal.languages, ['English', 'Tamil']);
  });
});
