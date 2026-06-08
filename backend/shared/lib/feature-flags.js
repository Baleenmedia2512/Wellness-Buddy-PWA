/**
 * backend/shared/lib/feature-flags.js
 *
 * Backend feature-flag registry per claude.md §3.5.
 *
 * Flag naming: `ff.<domain>.<feature-name>` (kebab-case after the
 * `ff.` prefix). Every flag MUST register:
 *   - `owner`           : GitHub handle responsible for removal.
 *   - `createdAt`       : ISO date the flag entered the codebase.
 *   - `removeBy`        : ISO date by which the flag MUST be removed
 *                         (90 days after full rollout per §3.5).
 *   - `description`     : one-line product intent.
 *   - `defaultEnabled`  : value when the env override is absent.
 *
 * Runtime resolution
 *   `isEnabled(name)` reads `process.env.FF_<UPPER_SNAKE>` first; if the
 *   env var is `'true'` or `'false'` (case-insensitive) that wins;
 *   otherwise the registered `defaultEnabled` is returned. Reads are
 *   pure — no caching, no Supabase calls — so tests can flip the env
 *   var between cases without bookkeeping.
 *
 * Stale-flag enforcement
 *   `findStaleFlags(now)` returns every registered flag whose `removeBy`
 *   date has passed. CI calls this in a guard script (per §15.2 row
 *   "Stale flags") to warn the team. Adding a flag without `removeBy`
 *   throws at registration time so unmaintainable flags can never land.
 */

const REGISTRY = Object.create(null);

function envKeyFor(flagName) {
  // ff.diary-feed → FF_DIARY_FEED
  return `FF_${flagName.replace(/^ff\./, '').replace(/-/g, '_').toUpperCase()}`;
}

function registerFlag(spec) {
  if (!spec || typeof spec !== 'object') {
    throw new Error('feature-flags: spec object required');
  }
  const { name, owner, createdAt, removeBy, description, defaultEnabled } = spec;
  if (!name || !/^ff\.[a-z][a-z0-9-]*$/.test(name)) {
    throw new Error(`feature-flags: invalid flag name '${name}' (must match ff.<kebab-case>)`);
  }
  if (REGISTRY[name]) {
    throw new Error(`feature-flags: flag '${name}' already registered`);
  }
  if (!owner)       throw new Error(`feature-flags: '${name}' missing owner`);
  if (!createdAt)   throw new Error(`feature-flags: '${name}' missing createdAt`);
  if (!removeBy)    throw new Error(`feature-flags: '${name}' missing removeBy`);
  if (!description) throw new Error(`feature-flags: '${name}' missing description`);
  if (typeof defaultEnabled !== 'boolean') {
    throw new Error(`feature-flags: '${name}' defaultEnabled must be boolean`);
  }
  REGISTRY[name] = Object.freeze({ ...spec });
  return REGISTRY[name];
}

/**
 * Resolve a flag for the current request.
 * @param {string} name
 * @returns {boolean}
 */
export function isEnabled(name) {
  const spec = REGISTRY[name];
  if (!spec) {
    // Unknown flag → treat as OFF and surface loudly. Better to fail
    // closed than to leak a removed feature back on after the registry
    // entry was deleted.
    return false;
  }
  const envValue = process.env[envKeyFor(name)];
  if (envValue === 'true')  return true;
  if (envValue === 'false') return false;
  if (typeof envValue === 'string') {
    const lower = envValue.toLowerCase();
    if (lower === 'true')  return true;
    if (lower === 'false') return false;
  }
  return spec.defaultEnabled;
}

/**
 * Test-only — peek at the registered spec. Production code MUST go
 * through `isEnabled`.
 */
export function getSpec(name) {
  return REGISTRY[name] || null;
}

/**
 * Returns every registered flag whose `removeBy` date is on/before
 * `now`. CI greps the count and warns when > 0.
 *
 * @param {Date} now
 * @returns {Array<{ name, removeBy, owner }>}
 */
export function findStaleFlags(now = new Date()) {
  const cutoff = now.getTime();
  return Object.values(REGISTRY)
    .filter((spec) => new Date(spec.removeBy).getTime() <= cutoff)
    .map(({ name, removeBy, owner }) => ({ name, removeBy, owner }));
}

/**
 * Test-only — wipe the registry between suites.
 * @internal
 */
export function __resetRegistry() {
  for (const key of Object.keys(REGISTRY)) {
    delete REGISTRY[key];
  }
}

// ─── Registered flags ───────────────────────────────────────────────────────

registerFlag({
  name:           'ff.diary-feed',
  owner:          '@principal-eng',
  createdAt:      '2026-06-05',
  // 90 days after full rollout per claude.md §3.5. Adjust on
  // promotion-to-prod; never extend without an ADR amendment.
  removeBy:       '2026-12-05',
  description:    'PR-B/PR-C of ADR-0003 — include `unknown` captures in the Diary list-entries read-model. When OFF, the endpoint behaves identically to the pre-Diary listAnalyses contract (food-only). When ON, the response also carries weight / education / watch / unknown rows for the same date.',
  defaultEnabled: true,
});
