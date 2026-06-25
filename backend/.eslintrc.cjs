/**
 * Backend ESLint config — VSA architecture protection.
 *
 * Why this file exists:
 *   - max-lines: every source file must stay ≤ 150 lines so each unit
 *     stays readable. Configured to ignore blank lines and comments.
 *   - no-restricted-syntax: process.env may only be read in
 *     backend/config/env.js so configuration is centralized.
 *   - no-restricted-imports: enforces Vertical Slice Architecture
 *     boundaries. A file inside features/<slice>/ may only import
 *     from (a) its own slice, (b) backend/shared or backend/utils,
 *     or (c) external libraries. Cross-slice imports — even via
 *     another feature's barrel — are forbidden.
 *
 * Severity note: max-lines is 'warn' because a few legacy services
 * still exceed the limit. Flip to 'error' once cleanup is complete.
 */
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'build/',
    'public/',
    'migrations/',
  ],
  rules: {
    // VSA: 150-line ceiling per file (excludes blank lines and comments).
    'max-lines': [
      'warn',
      { max: 150, skipBlankLines: true, skipComments: true },
    ],

    // VSA: process.env should only be read in backend/config/env.js.
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "MemberExpression[object.object.name='process'][object.property.name='env']",
        message:
          'VSA: process.env.* is forbidden outside backend/config/env.js. Import the validated config instead.',
      },
    ],

    // VSA: globally block deep-imports into a feature.
    // Cross-slice barrel imports are blocked by the features/** override below.
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              '**/features/*/**',
              '../features/*/**',
              '../../features/*/**',
            ],
            message:
              'VSA: a feature must not import from another feature. Move shared code to backend/shared/.',
          },
          {
            group: ['@supabase/supabase-js'],
            message:
              'VSA: do not import supabase-js directly. Use backend/shared/lib/supabaseClient.js.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // Only the env config module may read process.env.
      files: ['config/env.js', 'shared/config/env.js'],
      rules: { 'no-restricted-syntax': 'off' },
    },
    {
      // Only the shared supabase client may import @supabase/supabase-js.
      files: ['shared/lib/supabaseClient.js', 'utils/supabaseClient.js'],
      rules: { 'no-restricted-imports': 'off' },
    },
    {
      // VSA: code inside a feature slice may only import from
      //   (1) itself             — './...' or '../<own-subdir>/...'
      //   (2) backend/shared / backend/utils
      //   (3) external libraries — bare module specifiers
      // Patterns below catch both barrel ('../<other>') and deep
      // ('../<other>/services/X') sibling-feature imports.
      // Excluded: each slice's own index.js.
      files: ['features/**/*.js'],
      excludedFiles: ['features/*/index.js'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '../*/services/**',
                  '../*/repository',
                  '../*/repository.js',
                  '../*/index',
                  '../*/index.js',
                  '../*/*.service',
                  '../*/*.service.js',
                  '../*/*.repository',
                  '../*/*.repository.js',
                  '../../features/*',
                  '../../features/*/**',
                  '../../../features/*',
                  '../../../features/*/**',
                ],
                message:
                  'VSA: a feature must not import from another feature. Move shared code to backend/shared/ or backend/utils/.',
              },
              {
                group: ['@supabase/supabase-js'],
                message:
                  'VSA: do not import supabase-js directly. Use backend/shared/lib/supabaseClient.js.',
              },
            ],
          },
        ],
      },
    },
    {
      // pages/api handlers are thin proxies — no business logic, no DB queries.
      files: ['pages/api/**/*.js'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@supabase/supabase-js',
                  '**/supabaseClient*',
                  'pg',
                  'mysql2',
                ],
                message:
                  'VSA: handlers must not query the DB directly. Call a feature service which calls a repository.',
              },
            ],
          },
        ],
      },
    },
  ],
};
