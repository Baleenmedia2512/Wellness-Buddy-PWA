// Public surface of the `diary` feature slice (PR-C / ADR-0003).
//
// External consumers (currently only `shell/components/Dashboard.js`)
// MUST import via this barrel. Reaching into `./components/rows/*`
// from outside the slice is a dependency-cruiser violation.
export { default as DiaryFeed } from './components/DiaryFeed';

// Hook is exported so tests + a future embedded "today's diary" widget
// can subscribe without going through the full DiaryFeed shell.
export { useDiary } from './hooks/useDiary';
