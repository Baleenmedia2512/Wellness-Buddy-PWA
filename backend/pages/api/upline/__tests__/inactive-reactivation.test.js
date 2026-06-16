/**
 * inactive-reactivation.test.js
 *
 * Regression tests for the inactive-user OTP reactivation flow.
 *
 * Behaviour under test:
 *  1. upline/request.js — an inactive user (Status='Inactive') with an
 *     existing CoachId MUST be allowed to create a new OTP request so their
 *     coach can reactivate them. Active users with a coach must still be
 *     rejected.
 *
 *  2. upline/validate-otp.js — successfully validating an OTP now sets
 *     Status='Active' in team_table, which reactivates an inactive user.
 *
 * Per claude.md §9.1: api-layer tests require 85% line coverage.
 *
 * @jest-environment node
 */

// ---------------------------------------------------------------------------
// Minimal request / response mocks (no real HTTP)
// ---------------------------------------------------------------------------

function makeReq(body = {}) {
  return { method: 'POST', body, headers: {} };
}

function makeRes() {
  const res = { _status: 200, _body: null };
  res.status = (code) => { res._status = code; return res; };
  res.json = (body) => { res._body = body; return res; };
  res.setHeader = () => res;
  res.end = () => res;
  return res;
}

// ---------------------------------------------------------------------------
// Shared Supabase query builder stub
// ---------------------------------------------------------------------------

/**
 * Creates a chainable Supabase stub that returns predefined responses for
 * specific (table, column, value) lookups.
 *
 * @param {Object} tableMap  e.g. { team_table: { Email: { 'user@test.com': [...rows] } } }
 * @returns {Object} supabase-shaped client
 */
function makeSupabaseStub(tableMap = {}) {
  return {
    from(table) {
      let _filter = {};
      let _updateData = null;
      let _insertData = null;
      const chain = {
        select() { return chain; },
        eq(col, val) { _filter[col] = val; return chain; },
        neq() { return chain; },
        update(data) { _updateData = data; return chain; },
        insert(data) { _insertData = data; return chain; },
        order() { return chain; },
        limit() { return chain; },
        single() { return chain; },
        ilike(col, val) { _filter[col] = val; return chain; },
        // Resolve the chain by matching the stub map
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            if (_updateData !== null) {
              // Record the update for assertions
              chain._lastUpdate = _updateData;
              chain._lastUpdateFilter = { ..._filter };
              return resolve({ data: [_updateData], error: null });
            }
            if (_insertData !== null) {
              return resolve({ data: Array.isArray(_insertData) ? _insertData : [_insertData], error: null });
            }
            // Read: look up in tableMap
            const colMap = tableMap[table] || {};
            for (const [col, valMap] of Object.entries(colMap)) {
              const val = _filter[col];
              if (val !== undefined && valMap[val] !== undefined) {
                return resolve({ data: valMap[val], error: null });
              }
            }
            // Default: empty
            return resolve({ data: [], error: null });
          }).catch(reject);
        },
      };
      return chain;
    },
  };
}

// ---------------------------------------------------------------------------
// 1. upline/request.js — inactive user allowed to re-request OTP
// ---------------------------------------------------------------------------

describe('upline/request — inactive-user reactivation guard', () => {
  let handler;

  beforeAll(async () => {
    // Import after jest.mock so module resolution picks up mocks
    ({ default: handler } = await import('../request.js'));
  });

  test(
    'rejects active user who already has a coach (original guard unchanged)',
    async () => {
      const _supabase = makeSupabaseStub({
        team_table: {
          Email: {
            'active@test.com': [{
              UserId: 10, UserName: 'Active User', Email: 'active@test.com',
              TeamId: 'T001', CoachId: 99, Status: 'Active',
            }],
          },
        },
      });

      jest.doMock('../../../utils/supabaseClient.js', () => ({
        getSupabaseClient: () => _supabase,
        getISTTimestamp: () => new Date().toISOString(),
      }));

      const { default: h } = await import('../request.js?active');
      const req = makeReq({ email: 'active@test.com', coachId: 42 });
      const res = makeRes();
      await h(req, res);

      expect(res._status).toBe(400);
      expect(res._body.error).toMatch(/already have a coach/i);
    },
  );

  test(
    'allows inactive user who already has a coach to re-request OTP',
    async () => {
      // This is the new behaviour introduced by the bug-fix.
      // An Inactive user's CoachId is set — but the guard must pass.
      // We don't need to verify the full OTP email flow here; just check
      // that the endpoint does NOT return the "already have a coach" error.
      const sentEmails = [];
      const insertedRequests = [];

      const _supabase = {
        from(table) {
          let _filter = {};
          const chain = {
            select() { return chain; },
            eq(col, val) { _filter[col] = val; return chain; },
            neq() { return chain; },
            update(data) {
              // cancel-pending update
              return { eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
            },
            insert(data) {
              if (table === 'approval_requests_table') insertedRequests.push(data);
              return {
                select: () => ({
                  then: (r) => r({ data: [{ Id: 1 }], error: null }),
                }),
              };
            },
            order() { return chain; },
            limit() { return chain; },
            single() { return chain; },
            ilike(col, val) { _filter[col] = val; return chain; },
            then(resolve) {
              // Fake DB rows
              if (table === 'team_table') {
                if (_filter['Email'] === 'inactive@test.com') {
                  return Promise.resolve().then(() => resolve({
                    data: [{
                      UserId: 20, UserName: 'Inactive User',
                      Email: 'inactive@test.com',
                      TeamId: 'T002', CoachId: 55, Status: 'Inactive',
                    }], error: null,
                  }));
                }
                if (_filter['UserId'] === 55) {
                  return Promise.resolve().then(() => resolve({
                    data: [{
                      UserId: 55, UserName: 'Coach Name',
                      Email: 'coach@test.com', CoachName: 'Coach', Role: 'coach',
                    }], error: null,
                  }));
                }
              }
              if (table === 'approval_requests_table') {
                return Promise.resolve().then(() => resolve({ data: [], error: null }));
              }
              return Promise.resolve().then(() => resolve({ data: [], error: null }));
            },
          };
          return chain;
        },
      };

      jest.doMock('../../../utils/supabaseClient.js', () => ({
        getSupabaseClient: () => _supabase,
        getISTTimestamp: () => new Date().toISOString(),
      }));

      jest.doMock('nodemailer', () => ({
        createTransport: () => ({
          sendMail: (opts) => { sentEmails.push(opts); return Promise.resolve(); },
        }),
      }));

      jest.doMock('bcryptjs', () => ({
        hash: () => Promise.resolve('hashed-otp'),
      }));

      // Re-import to pick up mocks
      jest.resetModules();
      const { default: h } = await import('../request.js');
      const req = makeReq({ email: 'inactive@test.com', coachId: 55 });
      const res = makeRes();
      await h(req, res);

      // Must NOT return the "already have a coach" rejection
      expect(res._status).not.toBe(400);
      if (res._body?.error) {
        expect(res._body.error).not.toMatch(/already have a coach/i);
      }
    },
  );
});

// ---------------------------------------------------------------------------
// 2. validate-otp.js — Status='Active' written on OTP success
// ---------------------------------------------------------------------------

describe('upline/validate-otp — reactivation on success', () => {
  test('sets Status=Active in team_table after a valid OTP', async () => {
    const updates = [];

    const _supabase = {
      from(table) {
        let _filter = {};
        const chain = {
          select() { return chain; },
          eq(col, val) { _filter[col] = val; return chain; },
          update(data) {
            updates.push({ table, data, filter: { ..._filter } });
            return {
              eq: (col, val) => ({
                then: (r) => r({ data: [data], error: null }),
              }),
            };
          },
          order() { return chain; },
          limit() { return chain; },
          single() { return chain; },
          then(resolve) {
            if (table === 'team_table') {
              if (_filter['Email'] === 'inactive@test.com') {
                return Promise.resolve().then(() => resolve({
                  data: [{ UserId: 20 }], error: null,
                }));
              }
              if (_filter['UserId'] === 20) {
                // requester TeamId
                return Promise.resolve().then(() => resolve({
                  data: [{ TeamId: null }], error: null,
                }));
              }
              if (_filter['UserId'] === 55) {
                // coach TeamId
                return Promise.resolve().then(() => resolve({
                  data: [{ TeamId: null, UserName: 'Coach', Email: 'coach@test.com' }], error: null,
                }));
              }
            }
            if (table === 'approval_requests_table') {
              return Promise.resolve().then(() => resolve({
                data: [{
                  Id: 1, RequesterId: 20, UplineCoachId: 55,
                  OtpHash: 'hashed', OtpExpiresAt: new Date(Date.now() + 3600000).toISOString(),
                  OtpAttempts: 0, Status: 'pending',
                }], error: null,
              }));
            }
            return Promise.resolve().then(() => resolve({ data: [], error: null }));
          },
        };
        return chain;
      },
    };

    jest.resetModules();
    jest.doMock('../../../utils/supabaseClient.js', () => ({
      getSupabaseClient: () => _supabase,
      getISTTimestamp: () => new Date().toISOString(),
    }));
    jest.doMock('bcryptjs', () => ({
      compare: () => Promise.resolve(true), // OTP always valid in this test
    }));

    const { default: h } = await import('../validate-otp.js');
    const req = makeReq({ email: 'inactive@test.com', otp: '123456' });
    const res = makeRes();
    await h(req, res);

    // The STEP 3 team_table update must include Status: 'Active'
    const teamUpdate = updates.find(
      (u) => u.table === 'team_table' && u.data.Status === 'Active',
    );
    expect(teamUpdate).toBeDefined();
    expect(teamUpdate.data.Status).toBe('Active');
  });
});
