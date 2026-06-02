/**
 * Integration test for multi-log-type attendance tracking
 * Bug: Only education logs were counted for nutrition center attendance
 * Fix: Weight and food logs must also count toward attendance
 * 
 * Coverage target: ≥ 95 % lines / 90 % branches (claude.md §9.1)
 */
import { jest } from '@jest/globals';
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { attendanceForCenter, getAttendeeList } from '../centers.repository.js';

// Mock Supabase
jest.mock('../../../utils/supabaseClient.js');

describe('Multi-log-type attendance tracking', () => {
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      from: jest.fn(),
    };
    getSupabaseClient.mockReturnValue(mockSupabase);
  });

  describe('attendanceForCenter', () => {
    it('should aggregate users from education, weight, and food logs', async () => {
      // Mock chain for education logs
      const eduQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [{ UserId: 1 }, { UserId: 2 }],
          error: null,
        }),
      };

      // Mock chain for weight logs
      const weightQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [{ UserId: 2 }, { UserId: 3 }],
          error: null,
        }),
      };

      // Mock chain for food logs
      const foodQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [{ UserId: 3 }, { UserId: 4 }],
          error: null,
        }),
      };

      // Setup mock to return different query chains based on table
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'education_logs_table') return eduQuery;
        if (table === 'weight_records_table') return weightQuery;
        if (table === 'food_nutrition_data_table') return foodQuery;
        return eduQuery; // fallback
      });

      const result = await attendanceForCenter(5, '2026-06-01T00:00:00', '2026-06-01T23:59:59');

      // Should include users from all three log types
      expect(result).toHaveLength(6); // 2 edu + 2 weight + 2 food
      const userIds = result.map((r) => r.UserId);
      expect(userIds).toContain(1);
      expect(userIds).toContain(2);
      expect(userIds).toContain(3);
      expect(userIds).toContain(4);

      // Verify all three tables were queried
      expect(mockSupabase.from).toHaveBeenCalledWith('education_logs_table');
      expect(mockSupabase.from).toHaveBeenCalledWith('weight_records_table');
      expect(mockSupabase.from).toHaveBeenCalledWith('food_nutrition_data_table');
    });

    it('should handle case where only weight logs exist', async () => {
      const emptyQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const weightQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [{ UserId: 10 }],
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'weight_records_table') return weightQuery;
        return emptyQuery;
      });

      const result = await attendanceForCenter(5, '2026-06-01T00:00:00', '2026-06-01T23:59:59');

      expect(result).toHaveLength(1);
      expect(result[0].UserId).toBe(10);
    });

    it('should handle case where only food logs exist', async () => {
      const emptyQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const foodQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [{ UserId: 15 }],
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'food_nutrition_data_table') return foodQuery;
        return emptyQuery;
      });

      const result = await attendanceForCenter(5, '2026-06-01T00:00:00', '2026-06-01T23:59:59');

      expect(result).toHaveLength(1);
      expect(result[0].UserId).toBe(15);
    });
  });

  describe('getAttendeeList', () => {
    it('should deduplicate users across all log types and fetch their names', async () => {
      // Mock chains for log queries
      const eduQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [{ UserId: 1 }, { UserId: 2 }],
          error: null,
        }),
      };

      const weightQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [{ UserId: 2 }, { UserId: 3 }], // UserId 2 duplicated
          error: null,
        }),
      };

      const foodQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [{ UserId: 3 }, { UserId: 4 }], // UserId 3 duplicated
          error: null,
        }),
      };

      // Mock team_table query for user names
      const teamQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [
            { UserId: 1, UserName: 'Alice' },
            { UserId: 2, UserName: 'Bob' },
            { UserId: 3, UserName: 'Charlie' },
            { UserId: 4, UserName: 'Diana' },
          ],
          error: null,
        }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'education_logs_table') return eduQuery;
        if (table === 'weight_records_table') return weightQuery;
        if (table === 'food_nutrition_data_table') return foodQuery;
        if (table === 'team_table') return teamQuery;
        return eduQuery;
      });

      const result = await getAttendeeList(5, '2026-06-01T00:00:00', '2026-06-01T23:59:59');

      // Should return 4 unique users despite duplicates
      expect(result).toHaveLength(4);
      expect(result).toEqual(expect.arrayContaining([
        { userId: 1, userName: 'Alice' },
        { userId: 2, userName: 'Bob' },
        { userId: 3, userName: 'Charlie' },
        { userId: 4, userName: 'Diana' },
      ]));

      // Verify team_table was queried with unique user IDs
      expect(teamQuery.in).toHaveBeenCalledWith('"UserId"', expect.arrayContaining([1, 2, 3, 4]));
    });

    it('should throw error if any log table query fails', async () => {
      const errorQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        }),
      };

      const okQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({
          data: [{ UserId: 1 }],
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'weight_records_table') return errorQuery;
        return okQuery;
      });

      await expect(
        getAttendeeList(5, '2026-06-01T00:00:00', '2026-06-01T23:59:59')
      ).rejects.toThrow('Database connection failed');
    });

    it('should return empty array when no logs exist in any table', async () => {
      const emptyQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockSupabase.from.mockReturnValue(emptyQuery);

      const result = await getAttendeeList(5, '2026-06-01T00:00:00', '2026-06-01T23:59:59');

      expect(result).toEqual([]);
    });
  });
});
