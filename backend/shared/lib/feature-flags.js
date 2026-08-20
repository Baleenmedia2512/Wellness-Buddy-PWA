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
 *   - `minAppVersion`   : (optional) semver — when set, use
 *                         `isEnabledForAppVersion` so only clients at/above
 *                         this version get the new behaviour.
 *
 * Release rule (app version policy)
 *   New backend behaviour that older supported apps cannot handle MUST
 *   ship behind a flag default OFF. After the supporting AAB is live on
 *   Play Store, enable the flag and set minAppVersion (or
 *   FF_<FLAG>_MIN_APP_VERSION) to that build. Never enable such behaviour
 *   globally while older versions remain in the supported window.
 *   See backend/features/app-version/README.md.
 *
 * Runtime resolution
 *   `isEnabled(name)` reads `process.env.FF_<UPPER_SNAKE>` first; if the
 *   env var is `'true'` or `'false'` (case-insensitive) that wins;
 *   otherwise the registered `defaultEnabled` is returned. Reads are
 *   pure — no caching, no Supabase calls — so tests can flip the env
 *   var between cases without bookkeeping.
 *
 *   `isEnabledForAppVersion(name, clientVersion)` applies the global flag
 *   first, then the optional minAppVersion gate (fail closed when the
 *   gate is configured but clientVersion is missing/invalid).
 *
 * Stale-flag enforcement
 *   `findStaleFlags(now)` returns every registered flag whose `removeBy`
 *   date has passed. CI calls this in a guard script (per §15.2 row
 *   "Stale flags") to warn the team. Adding a flag without `removeBy`
 *   throws at registration time so unmaintainable flags can never land.
 */

import {
  isAtLeastVersion,
  parseSemver,
} from '../../features/app-version/domain/version.rules.js';

const REGISTRY = Object.create(null);

function envKeyFor(flagName) {
  // ff.diary-feed → FF_DIARY_FEED
  return `FF_${flagName.replace(/^ff\./, '').replace(/-/g, '_').toUpperCase()}`;
}

function minAppVersionEnvKeyFor(flagName) {
  // ff.diary-feed → FF_DIARY_FEED_MIN_APP_VERSION
  return `${envKeyFor(flagName)}_MIN_APP_VERSION`;
}

function registerFlag(spec) {
  if (!spec || typeof spec !== 'object') {
    throw new Error('feature-flags: spec object required');
  }
  const {
    name, owner, createdAt, removeBy, description, defaultEnabled, minAppVersion,
  } = spec;
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
  if (minAppVersion != null && minAppVersion !== '') {
    if (!parseSemver(minAppVersion)) {
      throw new Error(
        `feature-flags: '${name}' minAppVersion must be a semver string (got '${minAppVersion}')`,
      );
    }
  }
  REGISTRY[name] = Object.freeze({ ...spec });
  return REGISTRY[name];
}

/**
 * Resolve a flag for the current request (global on/off only).
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
 * Effective min app version for a flag: env override wins, else registry.
 * @param {string} name
 * @returns {string|null}
 */
export function getMinAppVersion(name) {
  const spec = REGISTRY[name];
  if (!spec) return null;
  const envMin = process.env[minAppVersionEnvKeyFor(name)];
  if (envMin != null && String(envMin).trim() !== '') {
    const trimmed = String(envMin).trim();
    return parseSemver(trimmed) ? trimmed : null;
  }
  if (spec.minAppVersion != null && String(spec.minAppVersion).trim() !== '') {
    return String(spec.minAppVersion).trim();
  }
  return null;
}

/**
 * Version-aware flag resolution for behaviour that older apps cannot handle.
 *
 * 1) if !isEnabled(name) → false
 * 2) if no minAppVersion configured → true (legacy / fully rolled-out flags)
 * 3) if clientVersion missing/invalid → false (fail closed)
 * 4) if clientVersion < minAppVersion → false
 * 5) else → true
 *
 * @param {string} name
 * @param {string|null|undefined} clientVersion
 * @returns {boolean}
 */
export function isEnabledForAppVersion(name, clientVersion) {
  if (!isEnabled(name)) return false;
  const minVersion = getMinAppVersion(name);
  if (!minVersion) return true;
  const meets = isAtLeastVersion(clientVersion, minVersion);
  if (meets === null) return false;
  return meets === true;
}

/**
 * Test-only — peek at the registered spec. Production code MUST go
 * through `isEnabled` / `isEnabledForAppVersion`.
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

/**
 * Test-only — register a flag after `__resetRegistry`.
 * @internal
 */
export function __registerFlag(spec) {
  return registerFlag(spec);
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

registerFlag({
  name:           'ff.body-parameters-card',
  owner:          '@principal-eng',
  createdAt:      '2026-06-09',
  removeBy:       '2026-09-30',
  description:    'ADR-0004 — Body Parameters Card share feature. Coach creates a styled card in Wellness Counselling, shares via WhatsApp. New members use the link to pre-fill setup wizard; existing members get silent profile override.',
  defaultEnabled: true,
});

registerFlag({
  name:           'ff.diary-timeline',
  owner:          '@diary-team',
  createdAt:      '2026-06-18',
  // 90 days after full rollout per claude.md §3.5. Adjust on
  // promotion-to-prod; never extend without an ADR amendment.
  removeBy:       '2026-12-31',
  description:    'Unified activity timeline layout in Diary: replaces stacked section-dashboards (NutritionDashboard / WeightDashboard / EducationDashboard + DiaryFeed(unknown)) with a single chronological DiaryFeed covering all entry kinds (food, weight, education, watch, unknown) for the selected IST day. Requires ff.diary-feed=ON. Toggle FF_DIARY_TIMELINE=false to revert to the stacked layout.',
  defaultEnabled: true,
});

registerFlag({
  name:           'ff.testimonials',
  owner:          '@testimonials-team',
  createdAt:      '2026-07-06',
  removeBy:       '2027-01-06',
  description:    'Before/after testimonial upload for members + coach OTP verification flow. Members upload photos + weights; coach receives email with OTP to verify. Coach dashboard shows team upload status.',
  defaultEnabled: true,
});

registerFlag({
  name:           'ff.reports-module',
  owner:          '@reports-team',
  createdAt:      '2026-07-06',
  removeBy:       '2026-12-31',
  description:    'Reports module: coach/upline analytics — Ideal Weight status report and Wellness Score Report (weights + persisted daily score + sponsor/coach). Tab visible only to coach/upline/admin/developer roles.',
  defaultEnabled: true,
});

registerFlag({
  name:           'ff.wellness-score-sheet',
  owner:          '@wellness-score-team',
  createdAt:      '2026-07-08',
  removeBy:       '2027-01-08',
  description:    'Wellness Score home tile, daily score API, admin Wellness Score Setup, and Wellness Score Report dashboard.',
  defaultEnabled: true,
});

registerFlag({
  name:           'ff.ai-credits',
  owner:          '@principal-eng',
  createdAt:      '2026-07-27',
  removeBy:       '2027-01-27',
  description:    'Boolean rollout for AI credit-based food analysis (Manual Entry AI Mode + Diary Retry AI). Numeric daily limit lives in ai_credits_config_table, not this flag.',
  defaultEnabled: true,
});

registerFlag({
  name:           'ff.nutrition-knowledge',
  owner:          '@nutrition-team',
  createdAt:      '2026-07-30',
  removeBy:       '2027-01-30',
  description:    'ADR-0005 — master nutrition knowledge base: search/resolve prefer approved master profiles, pass micros from AI history, draft candidates from successful AI, optional text enrich.',
  defaultEnabled: true,
});

registerFlag({
  name:           'ff.consent-gate',
  owner:          '@principal-eng',
  createdAt:      '2026-07-31',
  removeBy:       '2027-01-31',
  description:    'ADR-0006 — User Consent Form gate: require Agree before OTP/Google account creation; no team_table insert without consent; existing users blocked until accepted.',
  defaultEnabled: true,
});

registerFlag({
  name:           'ff.good-habit',
  owner:          '@principal-eng',
  createdAt:      '2026-08-16',
  removeBy:       '2027-02-16',
  description:    'ADR-0008 — Manual Log Good Habit tile: single photo. New good_habits_table; Diary kind good-habit; wellness-score good_habit_post. Does not change food logging or capture state machine.',
  defaultEnabled: true,
});

registerFlag({
  name:           'ff.dry-salad-catalog',
  owner:          '@nutrition-team',
  createdAt:      '2026-08-20',
  removeBy:       '2027-02-20',
  description:    'ADR-0009 — Dry Salad Manual Log search uses dry_salad_items_table instead of general food history. Saves still persist on food_nutrition_data_table.',
  defaultEnabled: true,
});
