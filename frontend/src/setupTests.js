/**
 * frontend/src/setupTests.js
 *
 * CRA-standard test setup. Loaded automatically by `react-scripts test`.
 *
 * Imports `@testing-library/jest-dom` so DOM-targeted matchers like
 * `toBeInTheDocument`, `toHaveTextContent`, `toBeVisible` work in
 * every Jest test under `frontend/src/`. The package is already a
 * devDependency (see `package.json`); this file was simply missing.
 *
 * Added 2026-06-05 alongside the new `features/diary` tests in PR-C
 * of ADR-0003. Pre-existing tests that did NOT use these matchers
 * continued to pass without it; PR-C is the first suite that does.
 */

import '@testing-library/jest-dom';
