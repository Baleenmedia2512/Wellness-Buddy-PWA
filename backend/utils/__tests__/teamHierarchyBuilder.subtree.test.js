/**
 * Step 3/4 — subtree-only team hierarchy (no full team_table scan).
 * Run: node --test backend/utils/__tests__/teamHierarchyBuilder.subtree.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTeamHierarchy,
  loadCoachSubtreeTeamUsers,
} from '../teamHierarchyBuilder.js';

/**
 * In-memory MySQL mock for team_table + coach_teams_table.
 */
function createSubtreeMock({ teamRows, coachTeams = [] }) {
  function applyFilters(rows, filters) {
    let out = [...rows];
    for (const f of filters) {
      if (f.type === 'eq') {
        out = out.filter((r) => String(r[f.col] ?? '') === String(f.val ?? ''));
      } else if (f.type === 'in') {
        const set = new Set(f.vals.map(Number));
        out = out.filter((r) => set.has(Number(r[f.col])));
      } else if (f.type === 'or') {
        const expr = String(f.expr);
        if (expr.includes('CommunityId.eq.') || expr.includes('CoachTeamId.eq.')) {
          const codes = [];
          for (const part of expr.split(',')) {
            const m = part.match(/^(CommunityId|CoachTeamId|TeamId)\.eq\.(.+)$/);
            if (m) codes.push(m[2]);
          }
          out = out.filter((r) =>
            codes.some((c) =>
              [r.CommunityId, r.CoachTeamId, r.TeamId].some((v) => String(v || '') === c),
            ),
          );
        } else {
          // CoachId.eq.X,CoCoachId.eq.X
          const ids = [];
          for (const part of expr.split(',')) {
            const m = part.match(/^(CoachId|CoCoachId)\.eq\.(.+)$/);
            if (m) ids.push(Number(m[2]));
          }
          out = out.filter((r) =>
            ids.includes(Number(r.CoachId)) || ids.includes(Number(r.CoCoachId)),
          );
        }
      }
    }
    return out;
  }

  function makeBuilder(table) {
    const source = table === 'coach_teams_table' ? coachTeams : teamRows;
    const filters = [];
    let orderCol = null;
    let mode = 'list';

    const run = () => {
      let rows = applyFilters(source, filters);
      if (orderCol) {
        rows = [...rows].sort((a, b) => Number(a[orderCol]) - Number(b[orderCol]));
      }
      return rows;
    };

    const builder = {
      select() { return builder; },
      eq(col, val) { filters.push({ type: 'eq', col, val }); return builder; },
      in(col, vals) { filters.push({ type: 'in', col, vals }); return builder; },
      or(expr) { filters.push({ type: 'or', expr }); return builder; },
      order(col) { orderCol = col; return builder; },
      maybeSingle() {
        mode = 'single';
        return Promise.resolve({ data: run()[0] || null, error: null });
      },
      range(from, to) {
        const slice = run().slice(from, to + 1);
        return Promise.resolve({ data: slice, error: null });
      },
      then(resolve, reject) {
        try {
          const rows = run();
          if (mode === 'single') resolve({ data: rows[0] || null, error: null });
          else resolve({ data: rows, error: null });
        } catch (e) {
          reject(e);
        }
      },
    };
    return builder;
  }

  return {
    from(table) {
      return makeBuilder(table);
    },
  };
}

const ROOT = 1;
const MID = 2;
const LEAF = 3;
const OUTSIDER = 99;
const NESTED = 4;

function baseTree({ midStatus = 'Active' } = {}) {
  return [
    {
      UserId: ROOT,
      UserName: 'Root Coach',
      Email: 'root@ex.com',
      Role: 'coach',
      CoachId: null,
      CoachTeamId: null,
      TeamId: null,
      Status: 'Active',
      ProfileImage: null,
      CommunityId: null,
    },
    {
      UserId: MID,
      UserName: 'Mid Coach',
      Email: 'mid@ex.com',
      Role: 'coach',
      CoachId: ROOT,
      CoachTeamId: null,
      TeamId: null,
      Status: midStatus,
      ProfileImage: null,
      CommunityId: null,
    },
    {
      UserId: LEAF,
      UserName: 'Leaf Member',
      Email: 'leaf@ex.com',
      Role: 'user',
      CoachId: MID,
      CoachTeamId: null,
      TeamId: null,
      Status: 'Active',
      ProfileImage: null,
      CommunityId: null,
    },
    {
      UserId: NESTED,
      UserName: 'Nested Under Leaf',
      Email: 'nested@ex.com',
      Role: 'user',
      CoachId: LEAF,
      CoachTeamId: null,
      TeamId: null,
      Status: 'Active',
      ProfileImage: null,
      CommunityId: null,
    },
    {
      UserId: OUTSIDER,
      UserName: 'Other Tree',
      Email: 'out@ex.com',
      Role: 'coach',
      CoachId: null,
      CoachTeamId: null,
      TeamId: null,
      Status: 'Active',
      ProfileImage: null,
      CommunityId: null,
    },
    {
      UserId: 100,
      UserName: 'Outsider Child',
      Email: 'outchild@ex.com',
      Role: 'user',
      CoachId: OUTSIDER,
      CoachTeamId: null,
      TeamId: null,
      Status: 'Active',
      ProfileImage: null,
      CommunityId: null,
    },
  ];
}

describe('loadCoachSubtreeTeamUsers', () => {
  it('includes nested downline and excludes users outside the subtree', async () => {
    const db = createSubtreeMock({ teamRows: baseTree() });
    const users = await loadCoachSubtreeTeamUsers(db, ROOT);
    const ids = users.map((u) => u.UserId).sort((a, b) => a - b);
    assert.deepEqual(ids, [ROOT, MID, LEAF, NESTED].sort((a, b) => a - b));
    assert.ok(!ids.includes(OUTSIDER));
    assert.ok(!ids.includes(100));
  });
});

describe('buildTeamHierarchy — subtree correctness', () => {
  it('small team: hierarchy shape and allMembers stay correct', async () => {
    const db = createSubtreeMock({ teamRows: baseTree() });
    const result = await buildTeamHierarchy(db, ROOT);

    assert.ok(result.hierarchy);
    assert.equal(result.hierarchy.userId, ROOT);
    assert.equal(result.hierarchy.teamMembers.length, 1);
    assert.equal(result.hierarchy.teamMembers[0].userId, MID);

    const mid = result.hierarchy.teamMembers[0];
    assert.equal(mid.teamMembers.length, 1);
    assert.equal(mid.teamMembers[0].userId, LEAF);

    const memberIds = result.allMembers.map((m) => m.UserId).sort((a, b) => a - b);
    assert.deepEqual(memberIds, [MID, LEAF, NESTED].sort((a, b) => a - b));
    assert.ok(!memberIds.includes(OUTSIDER));
    assert.ok(!memberIds.includes(100));
  });

  it('nested downline is included under the middle coach', async () => {
    const db = createSubtreeMock({ teamRows: baseTree() });
    const result = await buildTeamHierarchy(db, ROOT);
    const leaf = result.hierarchy.teamMembers[0].teamMembers[0];
    assert.equal(leaf.userId, LEAF);
    assert.equal(leaf.teamMembers.length, 1);
    assert.equal(leaf.teamMembers[0].userId, NESTED);
  });

  it('inactive middle coach promotes active descendants', async () => {
    const db = createSubtreeMock({ teamRows: baseTree({ midStatus: 'Inactive' }) });
    const result = await buildTeamHierarchy(db, ROOT);

    // Mid is hidden; Leaf (and Nested under Leaf) promote under Root
    assert.equal(result.hierarchy.teamMembers.length, 1);
    assert.equal(result.hierarchy.teamMembers[0].userId, LEAF);

    const memberIds = result.allMembers.map((m) => m.UserId);
    assert.ok(!memberIds.includes(MID), 'inactive mid not in default allMembers');
    assert.ok(memberIds.includes(LEAF));
    assert.ok(memberIds.includes(NESTED));
  });

  it('users outside subtree are not included', async () => {
    const db = createSubtreeMock({ teamRows: baseTree() });
    const result = await buildTeamHierarchy(db, ROOT);
    const allIds = [
      result.hierarchy.userId,
      ...result.allMembers.map((m) => m.UserId),
    ];
    assert.ok(!allIds.includes(OUTSIDER));
    assert.ok(!allIds.includes(100));
  });
});
