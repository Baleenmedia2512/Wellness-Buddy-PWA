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

  // Herbalife Shake Calculator — combine Formula 1 + Shakemate + Protein
  // and log the combined nutrition as a food diary entry.
  // Default OFF until product nutrition values are verified against official
  // Herbalife documentation. Set REACT_APP_FF_SHAKE_CALCULATOR=true or
  // localStorage 'ff.shake-calculator'='true' to enable during QA.
  'ff.shake-calculator': {
    envKey:         'REACT_APP_FF_SHAKE_CALCULATOR',
    storageKey:     'ff.shake-calculator',
    defaultEnabled: false,
    description:    'Herbalife Shake Nutrition Calculator entry point in NutritionDashboard.',
  },

  // Contact Picker API — one-tap pre-fill of the phone number field from the
  // device address book. Only visible on Android Chrome / Capacitor (the API
  // is not supported on iOS Safari or Firefox). Default OFF; enable per-device
  // via localStorage 'ff.contact-picker'='true' for QA.
  'ff.contact-picker': {
    envKey:         'REACT_APP_FF_CONTACT_PICKER',
    storageKey:     'ff.contact-picker',
    defaultEnabled: false,
    description:    'Contact Picker API shortcut on the phone login field.',
  },

  // Sample Events page and name-only demo registration. Owner: @principal-eng.
  // Remove by 2027-01-31, or when live event data replaces this demo.
  'ff.events': {
    envKey:         'REACT_APP_FF_EVENTS',
    storageKey:     'ff.events',
    defaultEnabled: true,
    description:    'Sample Events page and non-persistent name-only registration demo.',
  },

  // Testimonials — before/after Herbalife transformation photos with
  // coach OTP verification. Members upload; coach verifies via emailed OTP.
  // Default ON. Set REACT_APP_FF_TESTIMONIALS=false or
  // localStorage 'ff.testimonials'='false' to disable.
  'ff.testimonials': {
    envKey:         'REACT_APP_FF_TESTIMONIALS',
    storageKey:     'ff.testimonials',
    defaultEnabled: true,
    description:    'Before/after testimonial upload + coach OTP verification flow.',
  },

  // Member must agree + email OTP before Transformation shows on upline coach websites.
  // Default ON. Set REACT_APP_FF_TESTIMONIAL_UPLINE_DISPLAY_CONSENT=false to hide UI;
  // backend kill switch is FF_TESTIMONIAL_UPLINE_DISPLAY_CONSENT.
  'ff.testimonial-upline-display-consent': {
    envKey:         'REACT_APP_FF_TESTIMONIAL_UPLINE_DISPLAY_CONSENT',
    storageKey:     'ff.testimonial-upline-display-consent',
    defaultEnabled: true,
    description:    'Checkbox + member OTP to show Transformation on all upline coach websites.',
  },

  // Reports module — common analytics (Ideal Weight, Wellness Score, Nutrition, Trend).
  // Shown to every signed-in user. Leaf members see their own data; coaches
  // still see downline search / team scopes.
  // Default ON. Set REACT_APP_FF_REPORTS_MODULE=false or
  // localStorage 'ff.reports-module'='false' to disable.
  'ff.reports-module': {
    envKey:         'REACT_APP_FF_REPORTS_MODULE',
    storageKey:     'ff.reports-module',
    defaultEnabled: true,
    description:    'Reports module: Ideal Weight + Wellness Score + Nutrition + Trend for all users.',
  },

  // Wellness Score Sheet — home tile + 34-parameter score view + coach config.
  // Default ON for UI preview. Set REACT_APP_FF_WELLNESS_SCORE_SHEET=false or
  // localStorage 'ff.wellness-score-sheet'='false' to hide.
  'ff.wellness-score-sheet': {
    envKey:         'REACT_APP_FF_WELLNESS_SCORE_SHEET',
    storageKey:     'ff.wellness-score-sheet',
    defaultEnabled: true,
    description:    'Wellness Score home tile, daily score API, admin setup, and Wellness Score Report.',
  },

  // AI Credits — Manual Entry AI Mode + Diary Retry AI credit gate.
  // Numeric daily limit is DB-backed (admin config); this flag is rollout only.
  // Default ON. Set REACT_APP_FF_AI_CREDITS=false or
  // localStorage 'ff.ai-credits'='false' to disable.
  'ff.ai-credits': {
    envKey:         'REACT_APP_FF_AI_CREDITS',
    storageKey:     'ff.ai-credits',
    defaultEnabled: true,
    description:    'AI credit-based food analysis (Manual Entry AI Mode + Diary Retry AI).',
  },

  // DB-driven main-nav page access by role. Matrix edited in Admin Config.
  // When OFF, all main tabs stay visible (legacy). Kill switch: localStorage or env.
  'ff.nav-page-access': {
    envKey:         'REACT_APP_FF_NAV_PAGE_ACCESS',
    storageKey:     'ff.nav-page-access',
    defaultEnabled: true,
    description:    'Role → nav page access from DB (Customer/Sponsor/Admin/Developer).',
  },

  // ADR-0005 — master nutrition knowledge base (search/resolve micros).
  // Default ON. Set REACT_APP_FF_NUTRITION_KNOWLEDGE=false or
  // localStorage 'ff.nutrition-knowledge'='false' to disable.
  'ff.nutrition-knowledge': {
    envKey:         'REACT_APP_FF_NUTRITION_KNOWLEDGE',
    storageKey:     'ff.nutrition-knowledge',
    defaultEnabled: true,
    description:    'Master nutrition DB + history micros in food search (ADR-0005).',
  },

  // ADR-0006 — User Consent Form before account creation / app use.
  // Default ON. Set REACT_APP_FF_CONSENT_GATE=false or
  // localStorage 'ff.consent-gate'='false' to disable.
  'ff.consent-gate': {
    envKey:         'REACT_APP_FF_CONSENT_GATE',
    storageKey:     'ff.consent-gate',
    defaultEnabled: true,
    description:    'Require User Consent Form Agree before OTP/Google and app use (ADR-0006).',
  },

  // ADR-0008 — Manual Log Good Habit (single photo).
  // Default ON. Set REACT_APP_FF_GOOD_HABIT=false or
  // localStorage 'ff.good-habit'='false' to hide the tile.
  'ff.good-habit': {
    envKey:         'REACT_APP_FF_GOOD_HABIT',
    storageKey:     'ff.good-habit',
    defaultEnabled: true,
    description:    'Manual Log Good Habit and wellness-score Good Habit Post (ADR-0008).',
  },

  // Meal Builder — multi-add tray + bottom sheet (replaces cart UX in food search).
  // Default ON. Set REACT_APP_FF_MEAL_BUILDER=false or
  // localStorage 'ff.meal-builder'='false' to fall back to the orange cart panel.
  'ff.meal-builder': {
    envKey:         'REACT_APP_FF_MEAL_BUILDER',
    storageKey:     'ff.meal-builder',
    defaultEnabled: true,
    description:    'Meal Builder multi-add tray + sheet + voice insert in SmartFoodSearchModal.',
  },

  // ADR-0013 — Community ID create / co-sponsor via 24h sponsor OTP on Profile.
  // Default ON. Set REACT_APP_FF_COMMUNITY_ID_OTP=false or
  // localStorage 'ff.community-id-otp'='false' to restore immediate Save Profile.
  'ff.community-id-otp': {
    envKey:         'REACT_APP_FF_COMMUNITY_ID_OTP',
    storageKey:     'ff.community-id-otp',
    defaultEnabled: true,
    description:    'Profile Community ID Create + sponsor OTP (create / co-sponsor).',
  },

  // Profile height: first Save free; later changes need the coach's email approval.
  // Default ON. Set REACT_APP_FF_HEIGHT_CHANGE_OTP=false or
  // localStorage 'ff.height-change-otp'='false' to restore free height edits.
  'ff.height-change-otp': {
    envKey:         'REACT_APP_FF_HEIGHT_CHANGE_OTP',
    storageKey:     'ff.height-change-otp',
    defaultEnabled: true,
    description:    'Profile height lock after first save; OTP to change.',
  },

  // ADR-0015 — Community Position is a catalog role. Choosing one emails the coach.
  // Default ON. Set REACT_APP_FF_COMMUNITY_POSITION_OTP=false or
  // localStorage 'ff.community-position-otp'='false' to save the role with Profile.
  'ff.community-position-otp': {
    envKey:         'REACT_APP_FF_COMMUNITY_POSITION_OTP',
    storageKey:     'ff.community-position-otp',
    defaultEnabled: true,
    description:    'Profile Community Position coach OTP. Roles come from the catalog.',
  },

  // BroadCast — paid how-to + payment entry. Upload and Burst wait on recharge.
  // Default ON. Set REACT_APP_FF_BROADCAST=false or
  // localStorage 'ff.broadcast'='false' to hide the tab.
  'ff.broadcast': {
    envKey:         'REACT_APP_FF_BROADCAST',
    storageKey:     'ff.broadcast',
    defaultEnabled: true,
    description:    'BroadCast paid screen: how-to video and payment entry.',
  },

  // Profile Go Premium — opens Cashfree checkout. Kill switch hides the row.
  'ff.go-premium': {
    envKey:         'REACT_APP_FF_GO_PREMIUM',
    storageKey:     'ff.go-premium',
    defaultEnabled: true,
    description:    'Profile Go Premium opens Cashfree checkout.',
  },

  // Create Event — event form plus update, delete, postpone, and cancel.
  'ff.create-event': {
    envKey:         'REACT_APP_FF_CREATE_EVENT',
    storageKey:     'ff.create-event',
    defaultEnabled: true,
    description:    'Create Event page in the main navigation.',
  },

  // Unique per-user wallet. Cash-in after OTP to a selected Wellness Valley person.
  // Default ON. Set REACT_APP_FF_WALLET=false or localStorage 'ff.wallet'='false' to hide.
  'ff.wallet': {
    envKey:         'REACT_APP_FF_WALLET',
    storageKey:     'ff.wallet',
    defaultEnabled: true,
    description:    'Profile Wallet: unique balance and OTP-approved cash-in.',
  },

  // Coach Website portfolio — paid gate + form entry (Cashfree later).
  // Default ON. Set REACT_APP_FF_COACH_PORTFOLIO=false or
  // localStorage 'ff.coach-portfolio'='false' to hide.
  'ff.coach-portfolio': {
    envKey:         'REACT_APP_FF_COACH_PORTFOLIO',
    storageKey:     'ff.coach-portfolio',
    defaultEnabled: true,
    description:    'Coach Website: paid unlock and portfolio form entry.',
  },

  // Reports detail trial. Kill switch shows the full report again.
  'ff.report-trial': {
    envKey:         'REACT_APP_FF_REPORT_TRIAL',
    storageKey:     'ff.report-trial',
    defaultEnabled: true,
    description:    'Unpaid report details stay hidden until a 14-day trial or Premium.',
  },

  // Host tools gate (Create Event + Check-in + Paid Features). Same shared 14-day trial as Reports.
  'ff.events-trial': {
    envKey:         'REACT_APP_FF_EVENTS_TRIAL',
    storageKey:     'ff.events-trial',
    defaultEnabled: true,
    description:    'Gates Create Event / Check-in / Paid Features using the shared Reports 14-day trial (remaining days continue).',
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
