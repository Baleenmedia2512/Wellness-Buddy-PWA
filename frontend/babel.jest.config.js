/**
 * Babel config used ONLY by Jest (frontend unit tests).
 * react-scripts has its own internal Babel pipeline for
 * production builds and ignores this file at build time.
 *
 * Rationale: shared lib modules use ESM `import` syntax
 * (claude.md §2.2), but Jest still runs in CommonJS by
 * default. babel-jest transforms ESM → CJS for the test
 * runner when Jest is invoked directly (i.e. outside of
 * `react-scripts test`).
 *
 * Named babel.jest.config.js (not babel.config.js) to
 * avoid interfering with react-scripts / webpack.
 * jest.config.js references it explicitly via `transform`.
 */
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
};
