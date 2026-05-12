// Public surface of the `weight` feature slice.
// Other features and shared code should import from here, not from internal paths.
export { default as WeightCard } from './components/WeightCard';
export { default as WeightCardModal } from './components/WeightCardModal';
export { default as WeightDashboard } from './components/WeightDashboard';
export { default as ManualWeightEntryModal } from './components/ManualWeightEntryModal';
export { default as WeightLossLeaderboard } from './components/WeightLossLeaderboard';
export * from './services/weightDetectionService';
