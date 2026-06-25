/**
 * Frontend ESLint config — VSA architecture protection.
 *
 * Why this file exists:
 *   - max-lines: every source file must stay ≤ 150 lines so each unit
 *     stays readable. Configured to ignore blank lines and comments
 *     so JSDoc and whitespace don't count against the budget.
 *   - no-restricted-imports: enforces Vertical Slice Architecture
 *     boundaries. A file inside features/<slice>/ may only import
 *     from (a) its own slice, (b) shared/*, or (c) external libs.
 *     Cross-slice imports — even via another feature's barrel —
 *     are forbidden so slices stay independently movable.
 *
 * Severity note: max-lines is 'warn' (not 'error') because the
 * codebase still has ~50 legacy files over the limit. Flip to
 * 'error' once the cleanup pass is complete.
 */
module.exports = {
  extends: ['react-app'],
  ignorePatterns: [
    'build/',
    'node_modules/',
    'android/',
    'ios/',
    'public/',
    'src/App.js.backup',
  ],
  rules: {
    // VSA: 150-line ceiling per file (excludes blank lines and comments).
    'max-lines': [
      'warn',
      { max: 150, skipBlankLines: true, skipComments: true },
    ],

    // VSA: process.env should only be read in src/config/api.config.js.
    'no-restricted-syntax': [
      'warn',
      {
        selector:
          "MemberExpression[object.object.name='process'][object.property.name='env']",
        message:
          'VSA: process.env.* is forbidden outside src/config/api.config.js. Import the config instead.',
      },
    ],

    // VSA: globally block deep-imports into a feature from anywhere.
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
              '../../../features/*/**',
            ],
            message:
              "VSA: do not deep-import into a feature. Use the feature barrel: '<scope>/features/<slice>'.",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // Only the api.config module may read process.env.
      files: ['src/config/api.config.js', 'src/config/**.js'],
      rules: { 'no-restricted-syntax': 'off' },
    },
    {
      // VSA: code inside a feature slice may only import from
      //   (1) itself             — './...' or '../<own-subdir>/...'
      //   (2) shared/*           — '../../shared/...' / '../../../shared/...'
      //   (3) external libraries — bare module specifiers
      // Patterns below catch both barrel ('../<other>') and deep
      // ('../<other>/components/X') sibling-feature imports.
      // Excluded: each slice's own index.js (re-exports own internals).
      files: ['src/features/**/*.{js,jsx}'],
      excludedFiles: ['src/features/*/index.js'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '../*/components/**',
                  '../*/services/**',
                  '../*/hooks/**',
                  '../*/pages/**',
                  '../*/queries/**',
                  '../*/index',
                  '../*/index.js',
                  '../../*/components/**',
                  '../../*/services/**',
                  '../../*/hooks/**',
                  '../../*/pages/**',
                  '../../*/queries/**',
                  '../../*/index',
                  '../../*/index.js',
                  '**/features/*/**',
                  '../features/*',
                  '../features/*/**',
                  '../../features/*',
                  '../../features/*/**',
                  '../../../features/*',
                  '../../../features/*/**',
                ],
                message:
                  "VSA: a feature may only import from (1) itself ('./...'), (2) shared/*, or (3) external libraries. Move cross-cutting code to shared/.",
              },
            ],
          },
        ],
      },
    },
    {
      // Components are presentational — no direct HTTP / fetch.
      files: [
        'src/features/*/components/**/*.{js,jsx}',
        'src/shared/components/**/*.{js,jsx}',
      ],
      rules: {
        'no-restricted-imports': [
          'warn',
          {
            paths: [
              {
                name: 'axios',
                message:
                  'VSA: components are presentational. Move HTTP calls to a feature service or hook.',
              },
            ],
            patterns: [
              {
                group: ['**/features/*/**', '../features/*/**'],
                message:
                  "VSA: do not deep-import into a feature. Use the feature barrel: '<scope>/features/<slice>'.",
              },
            ],
          },
        ],
        'no-restricted-globals': [
          'warn',
          {
            name: 'fetch',
            message:
              'VSA: components must not call fetch. Use a feature service or hook.',
          },
        ],
      },
    },
  ],
};
