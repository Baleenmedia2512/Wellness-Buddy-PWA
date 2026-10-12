/**
 * Run: node --test backend/utils/__tests__/supabasePaginate.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllSupabaseRows } from '../supabasePaginate.js';

function mockPagedQuery(pages) {
  let call = 0;
  return () => ({
    range(from, to) {
      const pageSize = to - from + 1;
      const idx = call;
      call += 1;
      const data = pages[idx] ?? [];
      assert.equal(pageSize, 3, 'test uses pageSize 3');
      return Promise.resolve({ data, error: null });
    },
  });
}

describe('fetchAllSupabaseRows', () => {
  it('concatenates pages until a short page', async () => {
    const rows = await fetchAllSupabaseRows(
      mockPagedQuery([
        [{ id: 1 }, { id: 2 }, { id: 3 }],
        [{ id: 4 }, { id: 5 }],
      ]),
      { pageSize: 3 },
    );
    assert.deepEqual(rows.map((r) => r.id), [1, 2, 3, 4, 5]);
  });

  it('stops on an empty first page', async () => {
    const rows = await fetchAllSupabaseRows(mockPagedQuery([[]]), { pageSize: 3 });
    assert.deepEqual(rows, []);
  });

  it('throws when a page returns an error', async () => {
    await assert.rejects(
      () => fetchAllSupabaseRows(
        () => ({
          range() {
            return Promise.resolve({ data: null, error: { message: 'boom' } });
          },
        }),
        { pageSize: 3 },
      ),
      /boom/,
    );
  });
});
