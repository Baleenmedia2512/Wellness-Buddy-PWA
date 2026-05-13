// Facade — kept for backward compatibility with existing imports.
// All implementation lives in ./duplicateDetection/.
import { duplicateDetectionService } from './duplicateDetection/index.js';

export * from './duplicateDetection/index.js';
export default duplicateDetectionService;
