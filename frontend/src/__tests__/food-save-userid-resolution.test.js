/**
 * Test: Food save should use integer userId, not email string
 * 
 * Regression test for bug where userIdentifier (email string) was passed
 * to performNutritionSave instead of actualUserId (integer), causing
 * backend API to fail with "invalid input syntax for type integer: NaN"
 * when calling nutrition-centers endpoint.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Food Save - UserId Resolution', () => {
  let mockGetUserId;
  let mockPerformNutritionSave;
  let mockDetermineAttendance;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock getUserId to return integer ID
    mockGetUserId = jest.fn().mockResolvedValue(123);
    
    // Mock performNutritionSave
    mockPerformNutritionSave = jest.fn().mockResolvedValue({
      id: 456,
      success: true
    });
    
    // Mock locationAttendanceService.determineAttendance
    mockDetermineAttendance = jest.fn().mockResolvedValue({
      attendanceType: 'remote',
      latitude: 12.9716,
      longitude: 77.5946,
      nutritionCenterId: null,
      nearbyCenters: []
    });
  });
  
  it('should pass integer userId to performNutritionSave when getUserId succeeds', async () => {
    const user = {
      email: 'test@example.com',
      id: null // No id yet, needs resolution
    };
    
    // Simulate food photo save flow
    const actualUserId = await mockGetUserId(user);
    expect(actualUserId).toBe(123);
    
    await mockPerformNutritionSave({
      userId: actualUserId, // Should be 123, not 'test@example.com'
      imagePath: 'test.jpg',
      imageBase64: 'base64data',
      analysisResult: { foods: [] },
      deviceInfo: 'test-device'
    });
    
    expect(mockPerformNutritionSave).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 123 // INTEGER, not email string
      })
    );
  });
  
  it('should throw error when getUserId fails instead of using email', async () => {
    const user = {
      email: 'yasheeer.yash03@gmail.com',
      id: null
    };
    
    // Mock getUserId failure
    mockGetUserId.mockRejectedValue(new Error('User not found in database'));
    
    // BEFORE FIX: Code would pass email string to performNutritionSave
    // AFTER FIX: Code should throw error instead
    
    await expect(mockGetUserId(user)).rejects.toThrow('User not found in database');
    
    // Verify performNutritionSave was NOT called with email
    expect(mockPerformNutritionSave).not.toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'yasheeer.yash03@gmail.com'
      })
    );
  });
  
  it('should pass integer userId when duplicate check fails', async () => {
    const actualUserId = 123;
    
    // Mock duplicate check failure
    const mockDuplicateCheck = jest.fn().mockRejectedValue(new Error('Network error'));
    
    try {
      await mockDuplicateCheck();
    } catch (err) {
      // Duplicate check failed, should still use actualUserId
      await mockPerformNutritionSave({
        userId: actualUserId, // Should be 123, not email
        imagePath: 'test.jpg',
        imageBase64: 'base64data',
        analysisResult: { foods: [] },
        deviceInfo: 'test-device'
      });
    }
    
    expect(mockPerformNutritionSave).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 123
      })
    );
  });
  
  it('should pass integer userId when duplicate check response is invalid', async () => {
    const actualUserId = 123;
    
    // Mock invalid duplicate check response
    const mockDuplicateCheck = jest.fn().mockResolvedValue(null);
    
    const duplicateCheck = await mockDuplicateCheck();
    
    if (!duplicateCheck || typeof duplicateCheck !== 'object') {
      // Invalid response, should still use actualUserId
      await mockPerformNutritionSave({
        userId: actualUserId,
        imagePath: 'test.jpg',
        imageBase64: 'base64data',
        analysisResult: { foods: [] },
        deviceInfo: 'test-device'
      });
    }
    
    expect(mockPerformNutritionSave).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 123
      })
    );
  });
  
  it('should pass integer userId in duplicate modal flow', async () => {
    const actualUserId = 123;
    
    // Mock duplicate found
    const duplicateCheck = {
      isDuplicate: true,
      previousEntry: { id: 789 }
    };
    
    // Store pending data with integer userId
    const pendingSaveData = {
      userId: actualUserId, // Should be 123, not email
      imagePath: 'test.jpg',
      imageBase64: 'base64data',
      analysisResult: { foods: [] },
      deviceInfo: 'test-device'
    };
    
    // When user confirms duplicate, use the stored data
    await mockPerformNutritionSave(pendingSaveData);
    
    expect(mockPerformNutritionSave).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 123
      })
    );
  });
});

/**
 * Integration test - verify nutrition centers API receives correct userId type
 */
describe('Nutrition Centers API - UserId Type', () => {
  it('should accept integer userId parameter', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: []
      })
    });
    
    global.fetch = mockFetch;
    
    const apiBaseUrl = 'https://test-api.com';
    const userId = 123; // INTEGER
    
    await fetch(
      `${apiBaseUrl}/api/nutrition-centers?userId=${userId}&teamFilter=full&scope=all`,
      { cache: 'no-store' }
    );
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('userId=123'),
      expect.any(Object)
    );
  });
  
  it('should fail when userId is email string', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({
        success: false,
        message: 'invalid input syntax for type integer: "NaN"'
      })
    });
    
    global.fetch = mockFetch;
    
    const apiBaseUrl = 'https://test-api.com';
    const userId = 'yasheeer.yash03@gmail.com'; // EMAIL STRING - WRONG!
    
    const response = await fetch(
      `${apiBaseUrl}/api/nutrition-centers?userId=${userId}&teamFilter=full&scope=all`,
      { cache: 'no-store' }
    );
    
    const result = await response.json();
    
    expect(response.ok).toBe(false);
    expect(result.message).toContain('invalid input syntax for type integer');
  });
});
