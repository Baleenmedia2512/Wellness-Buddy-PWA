export {
  fetchNavAccessForMe,
  fetchNavAccessAdminConfig,
  saveNavAccessAdminConfig,
} from './services/navAccess.api.js';

export {
  NAV_PAGE_KEYS,
  MATRIX_ROLES,
  NAV_PAGE_LABELS,
  MATRIX_ROLE_LABELS,
  canAccessNavPage,
  allowedNavPageKeys,
  resolveNavTargetOrFallback,
  normalizeNavAccessMatrix,
  allNavPagesAllowed,
} from './domain/navAccess.rules.js';

export { default as NavPageAccessSetup } from './components/NavPageAccessSetup.jsx';
