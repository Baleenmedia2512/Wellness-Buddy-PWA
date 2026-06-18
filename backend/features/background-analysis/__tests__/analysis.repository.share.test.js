/**
 * Unit tests for analysis.repository share-link lookups.
 *
 * Regression guard (2026-06-17): `findPublicByToken` referenced a `supabase`
 * binding that no longer existed after the share-code refactor, throwing
 * `ReferenceError: supabase is not defined` on every public share view
 * (og-image endpoint + public capture viewer). These tests mock the Supabase
 * client at the module boundary and assert the function resolves cleanly and
 * merges the capture row with its linked food row.
 */
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { findPublicByToken } from '../analysis.repository.js';

jest.mock('../../../utils/supabaseClient.js', () => ({
  getSupabaseClient: jest.fn(),
  getISTTimestamp: () => '2026-06-17 00:00:00',
  convertToIST: (ts) => ({ istTimestamp: ts }),
}));

const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const SHARE_CODE = 'A7kX92';

/**
 * Build a chainable Supabase stub. `captureRow` is returned by the
 * captures_table lookup (maybeSingle); `foodRow` by the food table lookup.
 * Every builder method returns the same object so any call order resolves.
 */
function mockSupabase({ captureRow, foodRow }) {
  const builder = {};
  const passthrough = () => builder;
  builder.select = jest.fn(passthrough);
  builder.eq = jest.fn(passthrough);
  builder.order = jest.fn(passthrough);
  builder.limit = jest.fn(passthrough);
  // First maybeSingle() resolves the capture; second resolves the food row.
  builder.maybeSingle = jest
    .fn()
    .mockResolvedValueOnce({ data: captureRow, error: null })
    .mockResolvedValueOnce({ data: foodRow, error: null });

  getSupabaseClient.mockReturnValue({
    from: jest.fn(() => builder),
  });
  return builder;
}

describe('findPublicByToken', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves without throwing and merges capture + food rows (UUID token)', async () => {
    mockSupabase({
      captureRow: {
        ID: 10,
        UserID: '42',
        ShareExpiresAt: null,
        ImageType: 'food',
        ImageBase64: 'data:image/jpeg;base64,abc',
        CreatedAt: '2026-06-17 10:00:00',
      },
      foodRow: {
        ID: 99,
        AnalysisData: '{"foods":[{"name":"Rice"}]}',
        TotalCalories: 300,
        TotalProtein: 5,
      },
    });

    const row = await findPublicByToken(VALID_UUID);

    // Regression: this previously threw ReferenceError: supabase is not defined.
    expect(row).not.toBeNull();
    expect(row.ID).toBe(99);            // food row id surfaces as mealId
    expect(row.CaptureID).toBe(10);
    expect(row.ImageBase64).toBe('data:image/jpeg;base64,abc');
    expect(row.AnalysisData).toBe('{"foods":[{"name":"Rice"}]}');
    expect(row.TotalCalories).toBe(300);
  });

  it('returns the pending shape when no food row is linked yet', async () => {
    mockSupabase({
      captureRow: {
        ID: 11,
        UserID: '42',
        ShareExpiresAt: null,
        ImageType: 'pending',
        ImageBase64: 'data:image/jpeg;base64,xyz',
        CreatedAt: '2026-06-17 10:00:00',
      },
      foodRow: null,
    });

    const row = await findPublicByToken(SHARE_CODE);

    expect(row).not.toBeNull();
    expect(row.ID).toBe(11);            // falls back to capture id
    expect(row.AnalysisData).toBeNull();
    expect(row.TotalCalories).toBeNull();
  });

  it('returns null when the capture is not found', async () => {
    mockSupabase({ captureRow: null, foodRow: null });
    const row = await findPublicByToken(VALID_UUID);
    expect(row).toBeNull();
  });
});
