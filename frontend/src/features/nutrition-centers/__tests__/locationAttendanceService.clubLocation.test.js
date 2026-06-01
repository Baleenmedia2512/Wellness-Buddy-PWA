/**
 * Unit tests for getClubLocationIfNearby (locationAttendanceService.js)
 * Coverage target: ≥ 85 % lines / 75 % branches (claude.md §9.1 hooks layer)
 */
import { jest } from '@jest/globals';

// Mock Capacitor Geolocation so tests run outside a native device
jest.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    getCurrentPosition: jest.fn(),
  },
}));

// Prevent real fetch calls in tests
global.fetch = jest.fn();

import { locationAttendanceService, getClubLocationIfNearby } from '../services/locationAttendanceService';

describe('getClubLocationIfNearby', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns location payload when attendanceType is club', async () => {
    jest.spyOn(locationAttendanceService, 'determineAttendance').mockResolvedValue({
      attendanceType: 'club',
      latitude: 12.9716,
      longitude: 77.5946,
      nutritionCenterId: 7,
    });

    const result = await getClubLocationIfNearby('http://localhost:3001', 42);

    expect(result).toEqual({ latitude: 12.9716, longitude: 77.5946, nutritionCenterId: 7 });
  });

  it('returns null when attendanceType is remote', async () => {
    jest.spyOn(locationAttendanceService, 'determineAttendance').mockResolvedValue({
      attendanceType: 'remote',
      latitude: 12.9716,
      longitude: 77.5946,
      nutritionCenterId: null,
    });

    const result = await getClubLocationIfNearby('http://localhost:3001', 42);

    expect(result).toBeNull();
  });

  it('returns null when GPS permission denied', async () => {
    jest.spyOn(locationAttendanceService, 'determineAttendance').mockResolvedValue({
      attendanceType: 'remote',
      latitude: null,
      longitude: null,
      nutritionCenterId: null,
      locationError: 'PERMISSION_DENIED',
    });

    const result = await getClubLocationIfNearby('http://localhost:3001', 42);

    expect(result).toBeNull();
  });

  it('returns null and does not throw when determineAttendance throws', async () => {
    jest.spyOn(locationAttendanceService, 'determineAttendance').mockRejectedValue(new Error('Network fail'));

    const result = await getClubLocationIfNearby('http://localhost:3001', 42);

    expect(result).toBeNull();
  });

  it('returns null when latitude is missing from club result', async () => {
    jest.spyOn(locationAttendanceService, 'determineAttendance').mockResolvedValue({
      attendanceType: 'club',
      latitude: null,
      longitude: null,
      nutritionCenterId: 3,
    });

    const result = await getClubLocationIfNearby('http://localhost:3001', 42);

    expect(result).toBeNull();
  });
});
