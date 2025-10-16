import { registerPlugin, Capacitor } from "@capacitor/core";

// Register the native plugin
const GalleryMonitor = registerPlugin('GalleryMonitor', {
  web: {}, // Empty web implementation
  android: {}, // Android implementation will be loaded from native
  ios: undefined // iOS not supported
});

// Create a wrapped version of the plugin with initialization and error handling
const wrappedPlugin = {
  _initialized: false,
  _initPromise: null,

  async init() {
    if (this._initialized) return true;
    
    if (!this._initPromise) {
      this._initPromise = new Promise(async (resolve, reject) => {
        try {
          if (!Capacitor.isNativePlatform()) {
            console.warn("GalleryMonitor is only available on native platforms");
            resolve(false);
            return;
          }

          // Verify the plugin is registered
          if (!GalleryMonitor) {
            throw new Error("GalleryMonitor plugin is not registered");
          }

          // Set initialized immediately since we've verified the plugin exists
          this._initialized = true;
          console.log("✅ GalleryMonitor plugin initialized successfully");
          resolve(true);
        } catch (error) {
          console.warn("Failed to initialize GalleryMonitor:", error);
          this._initialized = false;
          reject(error);
        }
      });
    }

    return this._initPromise;
  },

  async setCurrentUser(options, bypassInit = false) {
    try {
      if (!bypassInit) {
        await this.init();
      }
      return await GalleryMonitor.setCurrentUser(options);
    } catch (error) {
      if (error.message?.includes('is not implemented') && !bypassInit) {
        // If it's an implementation error and we haven't bypassed init,
        // try one more time by bypassing the init check
        return await this.setCurrentUser(options, true);
      }
      console.error("Failed to set current user:", error);
      throw error;
    }
  },

  async getCurrentUser() {
    try {
      await this.init();
      return await GalleryMonitor.getCurrentUser();
    } catch (error) {
      console.error("Failed to get current user:", error);
      throw error;
    }
  },

  async requestPermissions() {
    try {
      await this.init();
      return await GalleryMonitor.requestPermissions();
    } catch (error) {
      console.error("Failed to request permissions:", error);
      throw error;
    }
  },

  async startService() {
    try {
      await this.init();
      return await GalleryMonitor.startService();
    } catch (error) {
      console.error("Failed to start service:", error);
      throw error;
    }
  },

  async stopService() {
    try {
      await this.init();
      return await GalleryMonitor.stopService();
    } catch (error) {
      console.error("Failed to stop service:", error);
      throw error;
    }
  },

  async checkGallery() {
    try {
      await this.init();
      return await GalleryMonitor.checkGallery();
    } catch (error) {
      console.error("Failed to check gallery:", error);
      throw error;
    }
  },

  addListener(eventName, listenerFunc) {
    if (!GalleryMonitor) {
      console.warn("GalleryMonitor not available for event listeners");
      return { remove: () => {} };
    }
    return GalleryMonitor.addListener(eventName, listenerFunc);
  }
};

export const GalleryMonitorPlugin = wrappedPlugin;
