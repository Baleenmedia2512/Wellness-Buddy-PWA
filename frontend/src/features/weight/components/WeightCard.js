/**
 * WeightCard.js — backward-compatible alias.
 *
 * The legacy `WeightCard` API is preserved so existing call sites
 * (e.g. WeightDashboard) keep working without changes. The actual
 * implementation now lives in `WeightHistoryCard`.
 */
export { default } from './WeightHistoryCard';
