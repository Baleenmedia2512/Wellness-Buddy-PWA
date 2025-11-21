import { registerPlugin, Capacitor } from "@capacitor/core";

// Register the native plugin
const CameraMonitor = registerPlugin('CameraMonitor', {
  web: {}, // Empty web implementation
  android: {}, // Android implementation will be loaded from native
  ios: undefined // iOS not supported
});

/**
 * CameraMonitorPlugin - React/JavaScript interface for camera monitoring
 * 
 * This plugin provides a convenient JavaScript API to control the native
 * CameraMonitorService, which detects when users take photos with their
 * personal camera app and shows notifications asking if they want to add
 * them to the Wellness app.
 * 
 * Features:
 * - Real-time photo detection using FileObserver (battery efficient)
 * - Native Android notifications with action buttons
 * - Event-driven architecture
 * 
 * Usage:
 * ```javascript
 * import { CameraMonitorPlugin } from './plugins/cameraMonitorPlugin';
 * 
 * // Start monitoring
 * await CameraMonitorPlugin.startMonitoring();
 * 
 * // Stop monitoring
 * await CameraMonitorPlugin.stopMonitoring();
 * 
 * // Check if monitoring
 * const { isRunning } = await CameraMonitorPlugin.isMonitoring();
 * ```
 */
const wrappedPlugin = {
  _initialized: false,
  _initPromise: null,

  /**
   * Initialize the plugin
   */
  async init() {
    if (this._initialized) return true;
    
    if (!this._initPromise) {
      this._initPromise = new Promise(async (resolve, reject) => {
        try {
          if (!Capacitor.isNativePlatform()) {
            console.warn("CameraMonitor is only available on native platforms");
            resolve(false);
            return;
          }

          // Verify the plugin is registered
          if (!CameraMonitor) {
            throw new Error("CameraMonitor plugin is not registered");
          }

          this._initialized = true;
          // console.log("✅ CameraMonitor plugin initialized successfully");
          resolve(true);
        } catch (error) {
          console.warn("Failed to initialize CameraMonitor:", error);
          this._initialized = false;
          reject(error);
        }
      });
    }

    return this._initPromise;
  },

  /**
   * Start camera monitoring service
   * This will begin watching the DCIM/Camera folder for new photos
   * 
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async startMonitoring() {
    try {
      await this.init();
      const result = await CameraMonitor.startMonitoring();
      // console.log("✅ Camera monitoring started:", result);
      return result;
    } catch (error) {
      // console.error("Failed to start camera monitoring:", error);
      throw error;
    }
  },

  /**
   * Stop camera monitoring service
   * 
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async stopMonitoring() {
    try {
      await this.init();
      const result = await CameraMonitor.stopMonitoring();
      console.log("✅ Camera monitoring stopped:", result);
      return result;
    } catch (error) {
      console.error("Failed to stop camera monitoring:", error);
      throw error;
    }
  },

  /**
   * Check if camera monitoring service is running
   * 
   * @returns {Promise<{isRunning: boolean}>}
   */
  async isMonitoring() {
    try {
      await this.init();
      const result = await CameraMonitor.isMonitoring();
      return result;
    } catch (error) {
      console.error("Failed to check monitoring status:", error);
      throw error;
    }
  },

  /**
   * Add event listener for camera monitoring events
   * 
   * @param {string} eventName - Event name (e.g., "photoDetected", "photoAdmitted")
   * @param {Function} listenerFunc - Callback function
   * @returns {Object} Listener handle with remove() method
   */
  addListener(eventName, listenerFunc) {
    if (!CameraMonitor) {
      console.warn("CameraMonitor not available for event listeners");
      return { remove: () => {} };
    }
    return CameraMonitor.addListener(eventName, listenerFunc);
  }
};

export const CameraMonitorPlugin = wrappedPlugin;
