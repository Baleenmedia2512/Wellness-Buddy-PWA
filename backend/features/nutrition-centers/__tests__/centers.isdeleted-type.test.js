/**
 * Regression test for IsDeleted type bug
 * Bug: Passing boolean `false` where INTEGER 0 is expected
 * Error: "invalid input syntax for type integer: 'false'"
 * Fix: Use 0 (integer) instead of false (boolean)
 * 
 * Coverage target: ≥ 95 % lines / 90 % branches (claude.md §9.1)
 */
import { jest } from '@jest/globals';
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { attendanceForCenter, getAttendeeList } from '../centers.repository.js';

jest.mock('../../../utils/supabaseClient.js');

describe('IsDeleted type correctness (integer not boolean)', () => {
  let mockSupabase;
  let mockEq;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Track all .eq() calls
    mockEq = jest.fn().mockReturnThis();
    
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: mockEq,
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockResolvedValue({
        data: [{ UserId: 1 }],
        error: null,
      }),
    };

    mockSupabase = {
      from: jest.fn().mockReturnValue(mockQuery),
    };
    
    getSupabaseClient.mockReturnValue(mockSupabase);
  });

  describe('attendanceForCenter', () => {
    it('should use integer 0 (not boolean false) for IsDeleted filter on education_logs_table', async () => {
      await attendanceForCenter(5, '2026-06-01T00:00:00', '2026-06-01T23:59:59');
      
      // Find the .eq('"IsDeleted"', ...) calls
      const isDeletedCalls = mockEq.mock.calls.filter(call => call[0] === '"IsDeleted"');
      
      expect(isDeletedCalls.length).toBeGreaterThan(0);
      
      // Every IsDeleted filter MUST use integer 0, not boolean false
      isDeletedCalls.forEach(call => {
        expect(call[1]).toBe(0);
        expect(call[1]).not.toBe(false);
        expect(typeof call[1]).toBe('number');
      });
    });

    it('should use integer 0 for IsDeleted filter on weight_records_table', async () => {
      await attendanceForCenter(5, '2026-06-01T00:00:00', '2026-06-01T23:59:59');
      
      const isDeletedCalls = mockEq.mock.calls.filter(call => call[0] === '"IsDeleted"');
      
      // Should have been called at least once for weight table
      expect(isDeletedCalls.length).toBeGreaterThanOrEqual(1);
      
      isDeletedCalls.forEach(call => {
        expect(call[1]).toStrictEqual(0);
      });
    });

    it('should use integer 0 for IsDeleted filter on food_nutrition_data_table', async () => {
      await attendanceForCenter(5, '2026-06-01T00:00:00', '2026-06-01T23:59:59');
      
      const isDeletedCalls = mockEq.mock.calls.filter(call => call[0] === '"IsDeleted"');
      
      // Should have been called at least once for food table
      expect(isDeletedCalls.length).toBeGreaterThanOrEqual(1);
      
      isDeletedCalls.forEach(call => {
        expect(call[1]).toStrictEqual(0);
      });
    });
  });

  describe('getAttendeeList', () => {
    beforeEach(() => {
      // Add mock for team_table query used in getAttendeeList
      const teamQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [{ UserId: 1, UserName: 'Test User' }],
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'team_table') return teamQuery;
        return {
          select: jest.fn().mockReturnThis(),
          eq: mockEq,
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockResolvedValue({
            data: [{ UserId: 1 }],
            error: null,
          }),
        };
      });
    });

    it('should use integer 0 for IsDeleted filter across all three log tables', async () => {
      await getAttendeeList(5, '2026-06-01T00:00:00', '2026-06-01T23:59:59');
      
      const isDeletedCalls = mockEq.mock.calls.filter(call => call[0] === '"IsDeleted"');
      
      // Should have 3 calls (one per log table: education, weight, food)
      expect(isDeletedCalls.length).toBe(3);
      
      isDeletedCalls.forEach(call => {
        expect(call[1]).toBe(0);
        expect(typeof call[1]).toBe('number');
      });
    });

    it('should never pass boolean false to IsDeleted filter', async () => {
      await getAttendeeList(5, '2026-06-01T00:00:00', '2026-06-01T23:59:59');
      
      const isDeletedCalls = mockEq.mock.calls.filter(call => call[0] === '"IsDeleted"');
      
      isDeletedCalls.forEach(call => {
        expect(call[1]).not.toBe(false);
        expect(call[1]).not.toBe('false'); // Also not the string
      });
    });
  });

  describe('Edge case: empty result sets', () => {
    beforeEach(() => {
      const emptyQuery = {
        select: jest.fn().mockReturnThis(),
        eq: mockEq,
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabase.from.mockReturnValue(emptyQuery);
    });

    it('should still use integer 0 even when no results returned', async () => {
      await attendanceForCenter(5, '2026-06-01T00:00:00', '2026-06-01T23:59:59');
      
      const isDeletedCalls = mockEq.mock.calls.filter(call => call[0] === '"IsDeleted"');
      
      expect(isDeletedCalls.length).toBeGreaterThan(0);
      
      isDeletedCalls.forEach(call => {
        expect(call[1]).toBe(0);
      });
    });
  });
});
