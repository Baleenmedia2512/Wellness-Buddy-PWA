export {
  fetchAiCreditsStatus,
  reserveAiCredit,
  confirmAiCredit,
  releaseAiCredit,
  releaseReservedAiCredit,
  fetchAiCreditsAdminConfig,
  saveAiCreditsAdminConfig,
} from './services/aiCredits.api.js';

export {
  getAiCreditUiState,
  reserveFailureMessage,
  autoDetectButtonLabel,
  autoDetectButtonSubtitle,
  autoDetectCreditsBadge,
  isAutoDetectEnabled,
} from './domain/creditUiState.js';

export {
  decideLunchAutoAi,
  decideMealWindowAutoAi,
  DEFAULT_LUNCH_WINDOW,
  DEFAULT_BREAKFAST_WINDOW,
  DEFAULT_DINNER_WINDOW,
  isWithinActivityWindow,
  isWithinEnabledAiWindow,
} from './domain/lunchAutoAi.rules.js';

export { default as AiCreditsSetup } from './components/AiCreditsSetup.jsx';
