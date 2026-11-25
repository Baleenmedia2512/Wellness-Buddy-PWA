/**
 * Run: node --test backend/features/coach-portfolio/__tests__/slug.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCoachPortfolioPath,
  isDuplicatePublicSlugError,
  isValidCoachPublicSlug,
  isValidCoachSlug,
  parseCoachPublicSlug,
  slugifyPart,
  suffixPublicSlugForUser,
} from '../domain/slug.rules.js';

describe('coach-portfolio slug.rules', () => {
  it('slugifies names, cities, and areas', () => {
    assert.equal(slugifyPart('Priya Sharma'), 'priya-sharma');
    assert.equal(slugifyPart('Coimbatore'), 'coimbatore');
    assert.equal(slugifyPart('  RS Puram!! '), 'rs-puram');
    assert.equal(slugifyPart('Adyar'), 'adyar');
  });

  it('builds /coach/city/area/display-name paths', () => {
    const path = buildCoachPortfolioPath({
      websiteDisplayName: 'Priya Wellness',
      fullName: 'Priya Sharma',
      city: 'Chennai',
      locality: 'Adyar',
    });
    assert.equal(path.citySlug, 'chennai');
    assert.equal(path.areaSlug, 'adyar');
    assert.equal(path.nameSlug, 'priya-wellness');
    assert.equal(path.publicSlug, 'chennai/adyar/priya-wellness');
    assert.equal(path.publicPath, '/coach/chennai/adyar/priya-wellness');
  });

  it('falls back when city/area/name missing', () => {
    const path = buildCoachPortfolioPath({ fullName: 'Demo', city: '', locality: '' });
    assert.equal(path.publicSlug, 'india/center/demo');
  });

  it('validates segments and full public slugs (v1 + v2)', () => {
    assert.equal(isValidCoachSlug('chennai'), true);
    assert.equal(isValidCoachSlug('adyar'), true);
    assert.equal(isValidCoachSlug('Bad Slug'), false);
    assert.equal(isValidCoachPublicSlug('chennai/adyar/priya-wellness'), true);
    assert.equal(isValidCoachPublicSlug('coimbatore/demo-rs-puram'), true);
    assert.equal(isValidCoachPublicSlug('demo-rs-puram'), false);
    assert.deepEqual(parseCoachPublicSlug('chennai/adyar/priya-wellness'), {
      citySlug: 'chennai',
      areaSlug: 'adyar',
      nameSlug: 'priya-wellness',
      pageSlug: 'priya-wellness',
      format: 'v2',
    });
    assert.deepEqual(parseCoachPublicSlug('coimbatore/demo-rs-puram'), {
      citySlug: 'coimbatore',
      areaSlug: null,
      nameSlug: 'demo-rs-puram',
      pageSlug: 'demo-rs-puram',
      format: 'v1',
    });
  });

  it('suffixes city/area/name slugs with userId for uniqueness', () => {
    assert.equal(
      suffixPublicSlugForUser('chennai/kodambakkam/avinash', 1065),
      'chennai/kodambakkam/avinash-1065',
    );
    assert.equal(
      suffixPublicSlugForUser('chennai/kodambakkam/avinash', 1065, 1),
      'chennai/kodambakkam/avinash-1065-2',
    );
    assert.equal(
      suffixPublicSlugForUser('chennai/kodambakkam/avinash-1065', 1065, 0),
      'chennai/kodambakkam/avinash-1065',
    );
  });

  it('detects MySQL duplicate PublicSlug errors', () => {
    assert.equal(
      isDuplicatePublicSlugError({
        message: "Duplicate entry 'chennai/kodambakkam/avinash' for key 'uq_coach_portfolio_slug'",
      }),
      true,
    );
    assert.equal(isDuplicatePublicSlugError({ code: 'P2002', message: 'Unique' }), true);
    assert.equal(isDuplicatePublicSlugError({ message: 'connection lost' }), false);
  });
});
