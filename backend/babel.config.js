/**
 * Babel config used ONLY by Jest (backend tests).
 * Next.js has its own SWC pipeline and ignores this file at runtime.
 *
 * Rationale: domain modules use ESM `import` syntax (claude.md §2.2),
 * but Jest still runs in CommonJS by default. Babel-jest transforms ESM
 * to CJS just for the test runner.
 */
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
};
