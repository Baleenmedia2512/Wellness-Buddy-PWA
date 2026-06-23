/**
 * @file Barrel for shared services. Re-exports the canonical
 * implementations so consumers can `import { ... } from 'shared/services'`
 * without knowing the file layout.
 *
 * Named exports only.
 */

// New canonical entry points (use these in new code).
export * from './userIdentity.js';
export * from './timeService.js';
export * from './orchestratorService.js';  // Phase 3 — single AI call entry point

// Existing shared services (re-exported for discoverability).
export * as apiClient from './apiClient.js';
export * as cacheManager from './cacheManager.js';
export * as cameraService from './cameraService.js';
export * as firebase from './firebase.js';
export * as galleryMonitor from './galleryMonitor.js';
export * as geminiService from './geminiService.js';
export * as imageTypeDetector from './imageTypeDetector.js';  // Legacy — do not use in new code
export * as reminderService from './reminderService.js';
export * as teamHierarchyService from './teamHierarchyService.js';
export * as tokenCost from './tokenCost/index.js';
