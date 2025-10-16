import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { GalleryMonitorPlugin } from '../plugins/galleryMonitorPlugin';

export const GalleryMonitor = {
  _isInitialized: false,
  _initializationPromise: null,

  async initialize() {
    // Check if we're running on Android
    if (Capacitor.getPlatform() !== 'android') {
      console.warn('Gallery monitoring only works on Android');
      return false;
    }

    if (this._initializationPromise) {
      return this._initializationPromise;
    }

    this._initializationPromise = new Promise(async (resolve) => {
      try {
        // Request permissions
        const hasPermission = await this.requestPermissions();
        if (!hasPermission) {
          this._isInitialized = false;
          resolve(false);
          return;
        }

        // Start the service
        const started = await this.startMonitoring();
        this._isInitialized = started;
        resolve(started);
      } catch (error) {
        console.error('Failed to initialize GalleryMonitor:', error);
        this._isInitialized = false;
        resolve(false);
      }
    });

    return this._initializationPromise;
  },

  async ensureInitialized() {
    if (this._isInitialized) return true;
    return this.initialize();
  },

  async setCurrentUser(userId, userEmail = null) {
    if (Capacitor.getPlatform() !== 'android') return;

    try {
      // Ensure plugin is initialized
      await this.ensureInitialized();
      
      const maxRetries = 3;
      let lastError = null;
      
      for (let i = 0; i < maxRetries; i++) {
        try {
          await GalleryMonitorPlugin.setCurrentUser({ 
            userId, 
            userEmail: userEmail // Use email if provided, otherwise fall back to userId
          });
          return; // Success
        } catch (error) {
          lastError = error;
          console.warn(`Attempt ${i + 1} failed to set current user:`, error);
          
          if (error.message?.includes('not implemented')) {
            // Wait a bit before retrying to allow plugin initialization
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          } else {
            break; // Don't retry other types of errors
          }
        }
      }
      
      // If we get here, all retries failed
      throw lastError || new Error('Failed to set current user after multiple attempts');
    } catch (error) {
      console.error('Failed to set current user for background service:', error);
      // Re-throw the error so the caller can handle it
      throw error;
    }
  },

  async getCurrentUser() {
    try {
      if (Capacitor.getPlatform() === 'android') {
        const result = await GalleryMonitorPlugin.getCurrentUser();
        return {
          userId: result.userId,
          userEmail: result.userEmail
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get current user from background service:', error);
      return null;
    }
  },

  async clearCurrentUser() {
    try {
      if (Capacitor.getPlatform() === 'android') {
        await GalleryMonitorPlugin.clearCurrentUser();
      }
    } catch (error) {
      console.error('Failed to clear current user from background service:', error);
    }
  },

  async requestPermissions() {
    try {
      // Request storage permission
      const permissionResult = await GalleryMonitorPlugin.requestPermissions();
      
      if (!permissionResult.granted) {
        // Use browser alert for now, or implement custom modal
        alert('Permission Needed: Please grant storage access to monitor your food photos');
        return false;
      }

      // Request battery optimization exemption
      await this.requestBatteryOptimizationExemption();
      
      return true;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  },

  async requestBatteryOptimizationExemption() {
    try {
      const packageName = await App.getPackageName();
      const intent = 'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS';
      const data = `package:${packageName}`;
      
      await App.openUrl({ url: `${intent}?${data}` });
    } catch (error) {
      console.error('Battery optimization request failed:', error);
    }
  },

  async startMonitoring() {
    try {
      // Register app state change listener for background handling
      App.addListener('appStateChange', async (state) => {
        if (!state.isActive) {
          await this.checkGallery();
        }
      });

      // Start native service
      await GalleryMonitorPlugin.startService();
      
      // Initial check
      await this.checkGallery();
      
      // Set up periodic checks (every 15 minutes)
      setInterval(this.checkGallery, 15 * 60 * 1000);
      
      return true;
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      return false;
    }
  },

  async checkGallery() {
    try {
      // This would trigger the native service to check for new images
      const result = await GalleryMonitorPlugin.checkGallery();
      
      if (result.newImages && result.newImages.length > 0) {
        await this.processNewImages(result.newImages);
      }
    } catch (error) {
      console.error('Gallery check failed:', error);
    }
  },

  async processNewImages(images) {
    try {
      // Log notification to console for now
      console.log(`New Food Photos Detected: Found ${images.length} new food photos to analyze`);
      
      // Note: The actual analysis and database saving now happens in the Android background service
      // This JavaScript method is mainly for logging and potential UI notifications
      
      // You could implement a custom notification system here
      // or install @capacitor/local-notifications package
      
      // The background service handles:
      // 1. Image analysis via Gemini API
      // 2. Saving results to MariaDB database
      // 3. Showing Android notifications
      // 4. Retry logic for failed operations
      
      console.log('✅ Background service will handle analysis and database saving');
      
    } catch (error) {
      console.error('Image processing failed:', error);
    }
  },

  async analyzeImage(image) {
    // Note: This method is now primarily handled by the Android background service
    // The service directly calls Gemini API and saves to database
    
    // If you need to analyze from JavaScript for UI purposes, keep this:
    try {
      const { GeminiService } = await import('./geminiService');
      return await GeminiService.analyzeFoodImage(image);
    } catch (error) {
      console.error('JavaScript image analysis failed:', error);
      return null;
    }
  },

  async saveAnalysis(analysis) {
    // Note: Database saving is now handled by the Android background service
    // This method can be used for local storage or UI updates
    
    // Optional: Save to local storage for UI purposes
    try {
      const savedAnalyses = JSON.parse(localStorage.getItem('backgroundAnalyses') || '[]');
      savedAnalyses.unshift({
        ...analysis,
        timestamp: Date.now(),
        source: 'background_service'
      });
      
      // Keep only last 50 analyses in local storage
      if (savedAnalyses.length > 50) {
        savedAnalyses.splice(50);
      }
      
      localStorage.setItem('backgroundAnalyses', JSON.stringify(savedAnalyses));
    } catch (error) {
      console.error('Failed to cache analysis locally:', error);
    }
  },

  // New method to get background analyses from local storage
  getLocalBackgroundAnalyses() {
    try {
      return JSON.parse(localStorage.getItem('backgroundAnalyses') || '[]');
    } catch (error) {
      console.error('Failed to get local background analyses:', error);
      return [];
    }
  },

  // New method to clear local background analyses
  clearLocalBackgroundAnalyses() {
    try {
      localStorage.removeItem('backgroundAnalyses');
    } catch (error) {
      console.error('Failed to clear local background analyses:', error);
    }
  }
};

export default GalleryMonitor;