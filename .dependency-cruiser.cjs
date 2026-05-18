/**
 * dependency-cruiser config — enforces claude.md §2.2 module boundaries.
 * Run: npx dependency-cruiser --config .dependency-cruiser.cjs backend frontend/src
 */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-feature-imports-backend',
      severity: 'error',
      comment: 'A feature folder cannot import from another feature folder. Use shared/ or an event.',
      from: { path: '^backend/features/([^/]+)/' },
      to: {
        path: '^backend/features/([^/]+)/',
        pathNot: '^backend/features/$1/'
      }
    },
    {
      name: 'no-cross-feature-imports-frontend',
      severity: 'error',
      comment: 'A feature folder cannot import from another feature folder. Use shared/.',
      from: { path: '^frontend/src/features/([^/]+)/' },
      to: {
        path: '^frontend/src/features/([^/]+)/',
        pathNot: '^frontend/src/features/$1/'
      }
    },
    {
      name: 'domain-must-be-pure',
      severity: 'error',
      comment: 'domain/ must not import I/O libraries (axios, fetch, pg, supabase, react, next).',
      from: { path: '/domain/' },
      to: {
        path: 'node_modules/(axios|pg|@supabase|next|react|react-dom|firebase)/'
      }
    },
    {
      name: 'shared-cannot-import-features',
      severity: 'error',
      from: { path: '(shared/|backend/shared/)' },
      to: { path: '(backend/features/|frontend/src/features/)' }
    },
    {
      name: 'no-pages-api-bypass-feature-layer',
      severity: 'error',
      comment: 'pages/api routes must go through a feature api/ entrypoint, not DB clients directly.',
      from: { path: '^backend/pages/api/' },
      to: { path: '(supabaseClient|dbPool|pg)' }
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true }
    },
    {
      name: 'no-deep-relatives',
      severity: 'warn',
      from: {},
      to: { path: '\\.\\./\\.\\./\\.\\./' }
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: { orphan: true, pathNot: '(\\.d\\.ts$|(^|/)\\.[^/]+\\.(js|ts)$|(^|/)(\\.next|build|out|dist|coverage)/)' },
      to: {}
    }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(node_modules|build|\\.next|out|dist|coverage|ios/|android/)' },
    tsConfig: { fileName: 'backend/jsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default']
    }
  }
};
