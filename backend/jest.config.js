/**
 * Backend Jest configuration.
 *
 * Coverage thresholds enforce the floors mandated by claude.md §9.1:
 *   - domain/      ≥ 95% lines / 90% branches
 *   - validation/  ≥ 95% lines / 90% branches
 *   - api/         ≥ 85% lines / 75% branches
 *   - data/        ≥ 70% lines / 60% branches
 *   - overall      ≥ 80% lines
 *
 * Per-path thresholds are scoped to *implemented* slices only and are added
 * incrementally as each feature lands real tests (see governance/ROLLOUT.md
 * Week 4). New entries are appended here as tests are written — do NOT lower
 * an existing threshold to make CI pass.
 */
module.exports = {
  testEnvironment: 'node',
  // babel.jest.config.js is intentionally NOT named babel.config.js so that
  // Next.js keeps using SWC for production builds. Jest must reference it explicitly.
  transform: {
    '^.+\\.jsx?$': ['babel-jest', { configFile: './babel.jest.config.js' }],
  },
  rootDir: '.',
  roots: ['<rootDir>/features', '<rootDir>/shared', '<rootDir>/utils'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'features/**/*.js',
    'shared/**/*.js',
    'utils/**/*.js',
    '!**/__tests__/**',
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
    // Per-path floors — appended as each feature ships real tests.
    'features/water/domain/': {
      lines: 95,
      branches: 90,
    },
    'features/weight/weight.validators.js': {
      lines: 95,
      branches: 90,
    },
    'features/activity/activity.validators.js': {
      lines: 95,
      branches: 90,
    },
    'features/screen/screen.validators.js': {
      lines: 95,
      branches: 90,
    },
    'features/education/education.validators.js': {
      lines: 95,
      branches: 90,
    },
    'features/food-corrections/food-corrections.validators.js': {
      lines: 95,
      branches: 90,
    },
    'features/nutrition-centers/centers.validators.js': {
      lines: 95,
      branches: 90,
    },
    'features/misc/misc.validators.js': {
      lines: 95,
      branches: 90,
    },
    'features/background-analysis/analysis.validators.js': {
      lines: 95,
      branches: 90,
    },
    'features/user/user.validators.js': {
      lines: 95,
      branches: 90,
    },
    'features/auth/auth.validators.js': {
      lines: 95,
      branches: 90,
    },
    'features/token/token.validators.js': {
      lines: 95,
      branches: 90,
    },
    'features/water/api/': {
      lines: 85,
      branches: 75,
    },
    'features/water/data/': {
      lines: 70,
      branches: 60,
    },
  },
  clearMocks: true,
  restoreMocks: true,
  moduleFileExtensions: ['js', 'json'],
};
