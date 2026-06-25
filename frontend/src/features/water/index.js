// Public surface of the `water` feature slice.
// External code MUST import from this barrel — never deep-import.
export {
  WaterTracker,
  WaterGlass,
  WaterControls,
  WaterHistory,
} from './components';
export { useWaterTracker } from './hooks';
