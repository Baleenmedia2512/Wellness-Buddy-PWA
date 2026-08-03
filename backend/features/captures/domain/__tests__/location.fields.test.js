/**
 * Unit tests for capture location field helpers.
 * Run: node --test backend/features/captures/domain/__tests__/location.fields.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  locationFieldsFromCapture,
  mergeLocationWithCapture,
  hasAnyLocationField,
} from '../location.fields.js';

describe('location.fields', () => {
  it('maps PascalCase capture columns to camelCase fields', () => {
    assert.deepEqual(
      locationFieldsFromCapture({
        Latitude: 12.9,
        Longitude: 77.6,
        City: 'Bengaluru',
        Village: 'Indiranagar',
        AttendanceType: 'club',
        NutritionCenterId: 42,
        CenterName: 'WV Club',
      }),
      {
        latitude: 12.9,
        longitude: 77.6,
        city: 'Bengaluru',
        village: 'Indiranagar',
        attendanceType: 'club',
        nutritionCenterId: 42,
        centerName: 'WV Club',
      },
    );
  });

  it('prefers request location and fills gaps from capture', () => {
    const merged = mergeLocationWithCapture(
      { latitude: 1, city: 'A', attendanceType: null },
      {
        Latitude: 9,
        Longitude: 8,
        City: 'B',
        Village: 'V',
        AttendanceType: 'remote',
        NutritionCenterId: null,
        CenterName: null,
      },
    );
    assert.deepEqual(merged, {
      latitude: 1,
      longitude: 8,
      city: 'A',
      village: 'V',
      attendanceType: 'remote',
      nutritionCenterId: null,
      centerName: null,
    });
  });

  it('detects any useful location signal', () => {
    assert.equal(hasAnyLocationField({}), false);
    assert.equal(hasAnyLocationField({ attendanceType: 'remote' }), true);
    assert.equal(hasAnyLocationField({ city: 'X' }), true);
  });
});
