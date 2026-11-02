export {
  getForMe,
  getAdminConfig,
  putAdminConfig,
} from './navAccess.service.js';

export {
  NAV_PAGE_KEYS,
  MATRIX_ROLES,
  DEFAULT_NAV_ACCESS_MATRIX,
  resolveMatrixRole,
  pagesForRole,
  canAccessPage,
  allowedPageKeys,
  allPagesAllowed,
  normalizeMatrix,
  matrixWithDefaultsForNewPages,
  validateMatrixInput,
} from './domain/navAccess.rules.js';
