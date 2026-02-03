import { registerPlugin } from '@capacitor/core';

/**
 * Android In-App Update Plugin Interface
 * Provides methods to check for and manage app updates via Google Play Store
 */

/**
 * Update event types
 */
export const InAppUpdateEvents = {
  UPDATE_AVAILABLE: 'updateAvailable',
  UPDATE_NOT_AVAILABLE: 'updateNotAvailable',
  UPDATE_DOWNLOADING: 'updateDownloading',
  UPDATE_DOWNLOADED: 'updateDownloaded',
  UPDATE_INSTALLING: 'updateInstalling',
  UPDATE_INSTALLED: 'updateInstalled',
  UPDATE_FAILED: 'updateFailed',
  UPDATE_CANCELED: 'updateCanceled',
};

/**
 * Update types
 */
export const UpdateType = {
  IMMEDIATE: 'immediate', // User must update to continue
  FLEXIBLE: 'flexible',   // User can continue using app while update downloads
};

const InAppUpdate = registerPlugin('InAppUpdate', {
  web: () => ({
    // Web implementation (no-op for web)
    checkForUpdate: async () => {
      console.log('InAppUpdate: Not available on web platform');
      return Promise.resolve();
    },
    completeUpdate: async () => {
      console.log('InAppUpdate: Not available on web platform');
      return Promise.resolve();
    },
    checkDownloadedUpdate: async () => {
      console.log('InAppUpdate: Not available on web platform');
      return Promise.resolve();
    },
  }),
});

/**
 * Check for available app updates
 * Triggers the update flow automatically based on priority
 * @returns {Promise<void>}
 */
export const checkForUpdate = async () => {
  try {
    await InAppUpdate.checkForUpdate();
  } catch (error) {
    console.error('Failed to check for update:', error);
    throw error;
  }
};

/**
 * Complete a flexible update (restart app to install)
 * Call this after receiving 'updateDownloaded' event
 * @returns {Promise<void>}
 */
export const completeUpdate = async () => {
  try {
    await InAppUpdate.completeUpdate();
  } catch (error) {
    console.error('Failed to complete update:', error);
    throw error;
  }
};

/**
 * Check if flexible update is downloaded and ready
 * Shows snackbar if update is ready
 * @returns {Promise<void>}
 */
export const checkDownloadedUpdate = async () => {
  try {
    await InAppUpdate.checkDownloadedUpdate();
  } catch (error) {
    console.error('Failed to check downloaded update:', error);
    throw error;
  }
};

/**
 * Add listener for update events
 * @param {string} eventName - Event name from InAppUpdateEvents
 * @param {Function} callback - Callback function
 * @returns {PluginListenerHandle}
 */
export const addUpdateListener = (eventName, callback) => {
  return InAppUpdate.addListener(eventName, callback);
};

/**
 * Remove all listeners for a specific event
 * @param {string} eventName - Event name from InAppUpdateEvents
 */
export const removeUpdateListeners = async (eventName) => {
  await InAppUpdate.removeAllListeners(eventName);
};

/**
 * Example usage:
 * 
 * // Check for updates on app start
 * import { checkForUpdate, addUpdateListener, InAppUpdateEvents, UpdateType } from './plugins/inAppUpdatePlugin';
 * 
 * // Add listeners
 * addUpdateListener(InAppUpdateEvents.UPDATE_AVAILABLE, (data) => {
 *   console.log('Update available:', data.updateType, data.availableVersionCode);
 *   if (data.updateType === UpdateType.IMMEDIATE) {
 *     console.log('Critical update - user must update');
 *   } else {
 *     console.log('Optional update available');
 *   }
 * });
 * 
 * addUpdateListener(InAppUpdateEvents.UPDATE_DOWNLOADING, (data) => {
 *   console.log(`Downloading: ${data.progress}%`);
 * });
 * 
 * addUpdateListener(InAppUpdateEvents.UPDATE_DOWNLOADED, () => {
 *   console.log('Update downloaded! Snackbar will show "Restart to install"');
 *   // User can choose when to restart
 * });
 * 
 * // Check for updates
 * checkForUpdate();
 */

export default InAppUpdate;
