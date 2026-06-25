import handler from '../../pages/api/coach/download-attendance-excel.js';
import { getSupabaseClient } from '../../utils/supabaseClient.js';

jest.mock('../../utils/supabaseClient.js', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../../utils/disciplineHelpers.js', () => ({
  formatDateForMySQL: () => '2026-05-22',
}));

jest.mock('../../shared/lib/logger.js', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

function createRes() {
  const res = {};
  res.setHeader = jest.fn();
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.end = jest.fn(() => res);
  return res;
}

function createSupabaseMock({ allUsers, attendanceLogs }) {
  return {
    from: jest.fn((table) => {
      if (table === 'team_table') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(async () => ({ data: allUsers, error: null })),
            })),
          })),
        };
      }

      if (table === 'coach_teams_table') {
        return {
          select: jest.fn(() => ({
            or: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(async () => ({ data: null, error: null })),
              })),
            })),
          })),
        };
      }

      if (table === 'education_logs_table') {
        return {
          select: jest.fn(() => ({
            filter: jest.fn(() => ({
              gte: jest.fn(() => ({
                lte: jest.fn(() => ({
                  or: jest.fn(async () => ({ data: attendanceLogs, error: null })),
                })),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table in test mock: ${table}`);
    }),
  };
}

describe('download-attendance-excel time formatting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps morning time unchanged when CreatedAt is a local timestamp string without timezone', async () => {
    const req = {
      method: 'GET',
      query: {
        userId: '100',
        date: '2026-05-22',
      },
    };
    const res = createRes();

    getSupabaseClient.mockReturnValue(
      createSupabaseMock({
        allUsers: [
          {
            UserId: 100,
            UserName: 'Coach User',
            Email: 'coach@example.com',
            Role: 'coach',
            CoachId: null,
            CoachTeamId: null,
            Status: 'Active',
            ProfileImage: null,
            PhoneNumber: '9999999999',
          },
          {
            UserId: 200,
            UserName: 'Member User',
            Email: 'member@example.com',
            Role: 'member',
            CoachId: 100,
            CoachTeamId: null,
            Status: 'Active',
            ProfileImage: null,
            PhoneNumber: '8888888888',
          },
        ],
        attendanceLogs: [
          {
            UserId: 200,
            CreatedAt: '2026-05-22T07:38:54',
            nutrition_center_id: null,
            center_name: null,
            attendance_type: 'remote',
            City: 'Chennai',
            Village: 'Adyar',
          },
        ],
      }),
    );

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(1);

    // Repro: this currently becomes 13:08:54 in UTC runtime due forced IST conversion.
    expect(payload.data[0].time).toBe('07:38:54');
  });
});
