// Public surface of the `weight` feature slice.
// Other features and shared code should import from here, not from internal paths.
export { default as WeightCard } from './shared/components/WeightCard';
export { default as WeightCardModal } from './shared/components/WeightCardModal';
export { default as WeightDashboard } from './shared/components/WeightDashboard';
export { default as ManualWeightEntryModal } from './shared/components/ManualWeightEntryModal';
export { default as WeightLossLeaderboard } from './shared/components/WeightLossLeaderboard';
export * from './shared/services/weightDetectionService';
