/**
 * Step 1 — prove CoachId / community / admin / dual-coaching fetches page past ~1000 rows.
 * Run: node --test backend/utils/__tests__/hierarchyScale.pagination.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchTeamUsersByCoachIdsPaged,
  fetchTeamUsersByCommunityCodePaged,
} from '../reportingHierarchyService.js';
import { fetchDualCoachingLevelMembers } from '../disciplineCalculationsQuery.js';
import { fetchAllActiveMembers } from '../../features/activity/activity-report.repository.js';
import { fetchAdminUsers } from '../../features/activity/time-report.repository.js';

/**
 * Minimal chainable MySQL mock that pages with .range() and supports .maybeSingle().
 * Filters in-memory by eq / in / or / Status.
 */
function createTeamTableMock(allRows, { pageSize = 1000 } = {}) {
  let lastRangeCalls = 0;

  function applyFilters(rows, filters) {
    let out = rows;
    for (const f of filters) {
      if (f.type === 'eq') {
        out = out.filter((r) => String(r[f.col]) === String(f.val));
      } else if (f.type === 'in') {
        const set = new Set(f.vals.map(Number));
        out = out.filter((r) => set.has(Number(r[f.col])));
      } else if (f.type === 'or') {
        // CommunityId.eq.X,CoachTeamId.eq.X,TeamId.eq.X
        const codes = [];
        for (const part of String(f.expr).split(',')) {
          const m = part.match(/^(CommunityId|CoachTeamId|TeamId)\.eq\.(.+)$/);
          if (m) codes.push(m[2]);
        }
        out = out.filter((r) =>
          codes.some((c) =>
            [r.CommunityId, r.CoachTeamId, r.TeamId].some((v) => String(v || '') === c),
          ),
        );
      }
    }
    return out;
  }

  function makeBuilder(table) {
    const filters = [];
    let orderCol = null;
    let maybeSingle = false;

    const builder = {
      select() { return builder; },
      eq(col, val) { filters.push({ type: 'eq', col, val }); return builder; },
      in(col, vals) { filters.push({ type: 'in', col, vals }); return builder; },
      or(expr) { filters.push({ type: 'or', expr }); return builder; },
      order(col) { orderCol = col; return builder; },
      maybeSingle() {
        maybeSingle = true;
        return builder.then ? builder : Promise.resolve(builder);
      },
      range(from, to) {
        lastRangeCalls += 1;
        assert.ok(to - from + 1 <= pageSize || pageSize === 1000);
        let rows = table === 'team_table' ? applyFilters(allRows, filters) : [];
        if (orderCol) {
          rows = [...rows].sort((a, b) => Number(a[orderCol]) - Number(b[orderCol]));
        }
        const slice = rows.slice(from, to + 1);
        return Promise.resolve({ data: slice, error: null });
      },
      then(resolve, reject) {
        // Support await on builder for maybeSingle / non-range queries
        try {
          let rows = table === 'team_table' ? applyFilters(allRows, filters) : [];
          if (orderCol) {
            rows = [...rows].sort((a, b) => Number(a[orderCol]) - Number(b[orderCol]));
          }
          if (maybeSingle) {
            resolve({ data: rows[0] || null, error: null });
          } else {
            // Unpaged await would silently truncate in prod — tests use .range via fetchAllMysqlRows
            resolve({ data: rows.slice(0, 1000), error: null });
          }
        } catch (e) {
          reject(e);
        }
      },
    };
    return builder;
  }

  const db = {
    from(table) {
      return makeBuilder(table);
    },
    get rangeCallCount() {
      return lastRangeCalls;
    },
  };
  return db;
}

function makeChildren(coachId, count, startId = 1) {
  return Array.from({ length: count }, (_, i) => ({
    UserId: startId + i,
    UserName: `U${startId + i}`,
    Email: `u${startId + i}@ex.com`,
    Role: 'user',
    CoachId: coachId,
    CoachTeamId: null,
    TeamId: null,
    Status: 'Active',
    PhoneNumber: null,
    Height: null,
    CommunityId: null,
    Bmr: null,
    PhysicalActivityLevel: null,
  }));
}

describe('hierarchy scale pagination — CoachId children', () => {
  it('returns all >1000 CoachId children (no silent truncation)', async () => {
    const children = makeChildren(42, 1105, 1000);
    const db = createTeamTableMock(children);
    const rows = await fetchTeamUsersByCoachIdsPaged(db, [42]);
    assert.equal(rows.length, 1105);
    assert.equal(rows[0].UserId, 1000);
    assert.equal(rows[rows.length - 1].UserId, 2104);
    assert.ok(db.rangeCallCount >= 2, 'must page more than once');
  });
});

describe('hierarchy scale pagination — community fetch', () => {
  it('returns all >1000 community-code rows', async () => {
    const rows = Array.from({ length: 1003 }, (_, i) => ({
      UserId: 5000 + i,
      UserName: `C${i}`,
      Role: 'user',
      CoachId: null,
      CommunityId: 'TEAM-A',
      CoachTeamId: null,
      TeamId: null,
      Status: 'Active',
    }));
    // Outsider with different community must not appear
    rows.push({
      UserId: 99999,
      UserName: 'Out',
      Role: 'user',
      CoachId: null,
      CommunityId: 'OTHER',
      CoachTeamId: null,
      TeamId: null,
      Status: 'Active',
    });
    const db = createTeamTableMock(rows);
    const fetched = await fetchTeamUsersByCommunityCodePaged(db, 'TEAM-A');
    assert.equal(fetched.length, 1003);
    assert.ok(!fetched.some((r) => r.UserId === 99999));
    assert.ok(db.rangeCallCount >= 2);
  });
});

describe('hierarchy scale pagination — dual-coaching level fetch', () => {
  it('returns all >1000 active level members', async () => {
    const children = makeChildren(7, 1001, 3000);
    children.push({
      UserId: 99998,
      UserName: 'Inactive',
      Role: 'user',
      CoachId: 7,
      Status: 'Inactive',
      CoachTeamId: null,
      TeamId: null,
      CommunityId: null,
      Bmr: null,
      PhysicalActivityLevel: null,
    });
    const db = createTeamTableMock(children);
    const fetched = await fetchDualCoachingLevelMembers(db, [7]);
    assert.equal(fetched.length, 1001);
    assert.ok(!fetched.some((r) => r.UserId === 99998));
    assert.ok(db.rangeCallCount >= 2);
  });
});

describe('hierarchy scale pagination — admin all-active', () => {
  it('fetchAllActiveMembers returns all >1000 active rows', async () => {
    const rows = makeChildren(1, 1002, 1);
    rows.push({
      UserId: 99997,
      UserName: 'Inactive',
      Role: 'user',
      CoachId: 1,
      Status: 'Inactive',
      Email: null,
      PhoneNumber: null,
    });
    const db = createTeamTableMock(rows);
    const fetched = await fetchAllActiveMembers(db);
    assert.equal(fetched.length, 1002);
    assert.ok(!fetched.some((r) => r.UserId === 99997));
  });

  it('fetchAdminUsers returns all >1000 active rows', async () => {
    const rows = Array.from({ length: 1004 }, (_, i) => ({
      UserId: i + 1,
      UserName: `A${i + 1}`,
      Email: null,
      Role: 'user',
      Status: 'Active',
      Bmr: null,
      PhysicalActivityLevel: null,
    }));
    const db = createTeamTableMock(rows);
    const fetched = await fetchAdminUsers(db);
    assert.equal(fetched.length, 1004);
  });
});
