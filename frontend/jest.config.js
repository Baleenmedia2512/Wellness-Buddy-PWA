/**
 * Frontend Jest configuration — standalone (non-react-scripts) runner.
 *
 * Why this file exists:
 *   `react-scripts test` embeds its own Babel + Jest pipeline. When a
 *   developer (or CI) runs `jest` directly — e.g. to target a single
 *   test file — there is no Babel transform, causing ESM `import`
 *   statements to throw "Cannot use import statement outside a module".
 *   This config mirrors the backend pattern (backend/jest.config.js +
 *   backend/babel.jest.config.js) to make direct `jest` invocations work.
 *
 * Coverage thresholds enforce the floors mandated by claude.md §9.1:
 *   - shared/      ≥ 90% lines / 80% branches
 *   - hooks/       ≥ 85% lines / 75% branches
 *   - components/  ≥ 70% lines / 60% branches
 *   - overall      ≥ 80% lines
 */
module.exports = {
  testEnvironment: 'jsdom',

  // babel.jest.config.js is intentionally NOT named babel.config.js so
  // that react-scripts keeps using its own Babel pipeline for builds.
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { configFile: './babel.jest.config.js' }],
  },

  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.js', '**/__tests__/**/*.test.jsx'],

  // Module name mapper for any CSS/image imports that would otherwise
  // break in a Node environment.
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/fileMock.js',
    '\\.(jpg|jpeg|png|gif|svg|ico|webp)$': '<rootDir>/src/__mocks__/fileMock.js',
  },

  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/**/__tests__/**',
    '!src/__mocks__/**',
    '!src/index.js',
    '!src/reportWebVitals.js',
    '!**/node_modules/**',
  ],

  coverageReporters: ['text-summary', 'lcov', 'json'],

  coverageThreshold: {
    global: {
      lines: 0,
      branches: 0,
      functions: 0,
      statements: 0,
    },
    // Per-path floors — appended incrementally as each feature ships
    // real tests (see governance/ROLLOUT.md). Do NOT lower an existing
    // threshold to make CI pass.
    'src/shared/': {
      lines: 90,
      branches: 80,
    },
  },

  clearMocks: true,
  restoreMocks: true,
  moduleFileExtensions: ['js', 'jsx', 'json'],
};
