/**
 * Run: node --test backend/shared/lib/__tests__/reverseGeocode.area.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStreetAddressFromNominatim,
  pickShortAreaName,
  shortenAreaLabel,
} from '../reverseGeocode.js';

describe('reverseGeocode short area labels', () => {
  it('keeps simple area names', () => {
    assert.equal(shortenAreaLabel('Adyar'), 'Adyar');
    assert.equal(shortenAreaLabel('Vadapalani'), 'Vadapalani');
    assert.equal(shortenAreaLabel('RS Puram'), 'RS Puram');
  });

  it('drops lengthy comma-separated tails', () => {
    assert.equal(
      shortenAreaLabel('Adyar, Chennai, Tamil Nadu, 600020, India'),
      'Adyar',
    );
  });

  it('picks a single Nominatim suburb/neighbourhood', () => {
    assert.equal(pickShortAreaName({
      suburb: 'Vadapalani',
      neighbourhood: 'Some Long Micro Locality Name Extra',
      hamlet: 'Extra',
    }), 'Vadapalani');
    assert.equal(pickShortAreaName({
      neighbourhood: 'Adyar',
      suburb: null,
    }), 'Adyar');
  });

  it('builds street line from house number + road', () => {
    assert.equal(
      buildStreetAddressFromNominatim({ house_number: '12', road: 'Arcót Road' }),
      '12 Arcót Road',
    );
    assert.equal(
      buildStreetAddressFromNominatim({ road: '100 Feet Road' }),
      '100 Feet Road',
    );
  });
});
