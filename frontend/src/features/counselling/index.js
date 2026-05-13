// Public surface of the `counselling` feature slice.
// External code MUST import from this barrel — never deep-import.
export { WellnessCounsellingForm, HealthProblemChips } from './components';
export {
  HealthProblemSection,
  EatingHabitsSection,
  SleepQualitySection,
  MedicationSection,
} from './sections';
export { useCounsellingForm } from './hooks';
export { saveAssessment } from './services';
