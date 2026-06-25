/**
 * frontend/src/config/featureFlags.js
 *
 * Frontend-side mirror of backend/shared/lib/feature-flags.js.
 *
 * Per claude.md §1.2 the only place allowed to read `process.env.*` for
 * feature flags is this config file — components import `isFlagEnabled`
 * here so the resolution policy is centralised.
 *
 * Resolution order for `isFlagEnabled(name)` (first match wins):
 *   1. `localStorage` override (`ff.<name>` set to `'true'` / `'false'`)
 *      — useful for QA and per-device opt-in during rollout.
 *   2. `process.env.REACT_APP_FF_<UPPER_SNAKE>` — set at build time per
 *      environment.
 *   3. Registered `defaultEnabled` — last resort.
 *
 * Registered flags below MUST stay in step with the backend registry
 * (`backend/shared/lib/feature-flags.js`). When the backend flips a
 * default, the frontend follows in the next deploy.
 */

const REGISTRY = Object.freeze({
  // PR-C of ADR-0003 — mount the new Diary tab inside Dashboard.js.
  // Backend mirror controls whether the read-model surfaces `unknown`
  // captures; this frontend flag controls whether the tab is visible
  // at all. Default ON: AI-detection failures route to the Diary "Other"
  // row flow (PR-D) and the unknown share viewer (PR-E) instead of the
  // legacy disambiguation modal. Set REACT_APP_FF_DIARY_FEED=false or
  // localStorage 'ff.diary-feed'='false' to fall back to the old method.
  'ff.diary-feed': {
    envKey:         'REACT_APP_FF_DIARY_FEED',
    storageKey:     'ff.diary-feed',
    defaultEnabled: true,
    description:    'Mount the Diary tab in Dashboard.js (ADR-0003 PR-C).',
  },

  // Unified activity timeline layout. When ON (requires ff.diary-feed=ON),
  // Dashboard.js shows a single chronological DiaryFeed (all entry kinds)
  // instead of the stacked NutritionDashboard / WeightDashboard /
  // EducationDashboard + DiaryFeed(unknown) layout. Set
  // REACT_APP_FF_DIARY_TIMELINE=false or
  // localStorage 'ff.diary-timeline'='false' to revert to the stacked layout.
  'ff.diary-timeline': {
    envKey:         'REACT_APP_FF_DIARY_TIMELINE',
    storageKey:     'ff.diary-timeline',
    defaultEnabled: true,
    description:    'Unified activity timeline layout in Diary (replaces stacked section-dashboards).',
  },
});

function readStorage(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    // localStorage access denied (privacy mode, embedded iframe). Treat
    // as "no override" and fall through to env / default. Logging would
    // be noisy for a read this frequent.
    return null;
  }
}

function parseBoolean(raw) {
  if (typeof raw !== 'string') return null;
  const lower = raw.trim().toLowerCase();
  if (lower === 'true')  return true;
  if (lower === 'false') return false;
  return null;
}

/**
 * Returns whether the named flag is enabled for the current build /
 * device. Unknown flags return `false` (fail-closed — matches the
 * backend module's behaviour).
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isFlagEnabled(name) {
  const spec = REGISTRY[name];
  if (!spec) return false;

  const storageOverride = parseBoolean(readStorage(spec.storageKey));
  if (storageOverride !== null) return storageOverride;

  const envOverride = parseBoolean(process.env[spec.envKey]);
  if (envOverride !== null) return envOverride;

  return spec.defaultEnabled;
}

/**
 * Test-only — peek at the registered spec. Components MUST go through
 * `isFlagEnabled`.
 */
export function getFlagSpec(name) {
  return REGISTRY[name] || null;
}
