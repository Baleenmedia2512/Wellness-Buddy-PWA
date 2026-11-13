/**
 * Run: node --test backend/features/user/domain/profileIntro.rules.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeHerbalifeJoinedOn,
  normalizeProfileIntroPatch,
  normalizeSocialUrl,
} from './profileIntro.rules.js';

describe('profile introduction', () => {
  it('accepts a title and a blank social link', () => {
    const result = normalizeProfileIntroPatch({
      professionalTitle: '  Wellness coach  ',
      instagram: '',
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.professionalTitle, 'Wellness coach');
    assert.equal(result.value.instagram, '');
  });

  it('accepts instagram, youtube, and linkedin links', () => {
    assert.equal(
      normalizeSocialUrl('instagram.com/wellness.coach', 'instagram'),
      'https://instagram.com/wellness.coach',
    );
    assert.equal(
      normalizeSocialUrl('https://youtu.be/abc', 'youtube')?.includes('youtu.be'),
      true,
    );
    assert.equal(normalizeSocialUrl('https://facebook.com/me', 'linkedin'), null);
  });

  it('stores the Herbalife date as dd/mm/yyyy and rejects a future day', () => {
    assert.equal(normalizeHerbalifeJoinedOn('15/01/2020'), '15/01/2020');
    assert.equal(normalizeHerbalifeJoinedOn('05062002'), '05/06/2002');
    assert.equal(normalizeHerbalifeJoinedOn('2020-01-15'), '15/01/2020');
    assert.equal(normalizeHerbalifeJoinedOn('15-01-2020'), null);
    assert.equal(normalizeHerbalifeJoinedOn('01/01/2099'), null);
  });

  it('limits about me, qualification, and languages', () => {
    const tooLong = normalizeProfileIntroPatch({ aboutMe: 'a'.repeat(501) });
    assert.equal(tooLong.ok, false);
    const languages = normalizeProfileIntroPatch({ languages: ['en', 'hi', 'EN'] });
    assert.equal(languages.ok, true);
    assert.deepEqual(languages.value.languages, ['en', 'hi']);
  });

  it('leaves omitted keys unchanged', () => {
    const result = normalizeProfileIntroPatch({});
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, {});
  });
});
