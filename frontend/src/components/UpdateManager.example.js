/**
 * Example usage of Android In-App Updates in a React component
 * Add this to your App.js or a dedicated UpdateManager component
 */

import React, { useEffect, useState } from 'react';
import { 
  checkForUpdate, 
  addUpdateListener, 
  InAppUpdateEvents,
  UpdateType,
  completeUpdate 
} from './plugins/inAppUpdatePlugin';

const UpdateManager = () => {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isUpdateReady, setIsUpdateReady] = useState(false);

  useEffect(() => {
    // Setup all update listeners
    const listeners = [
      // When update is available
      addUpdateListener(InAppUpdateEvents.UPDATE_AVAILABLE, (data) => {
        console.log('📱 Update available:', data);
        setUpdateInfo({
          type: data.updateType,
          version: data.availableVersionCode
        });

        if (data.updateType === UpdateType.IMMEDIATE) {
          // Google Play will automatically show blocking UI
          console.log('Critical update - Google Play will handle UI');
        } else {
          // Flexible update - can show custom notification
          console.log('✨ Optional update available - downloading...');
          showFlexibleUpdateNotification(data.availableVersionCode);
        }
      }),

      // No update available
      addUpdateListener(InAppUpdateEvents.UPDATE_NOT_AVAILABLE, () => {
        console.log('✅ App is up to date');
        setUpdateInfo(null);
      }),

      // Download progress (flexible only)
      addUpdateListener(InAppUpdateEvents.UPDATE_DOWNLOADING, (data) => {
        const progress = data.progress || 0;
        console.log(`⬇️ Downloading update: ${progress}%`);
        setDownloadProgress(progress);
      }),

      // Download complete (flexible only)
      addUpdateListener(InAppUpdateEvents.UPDATE_DOWNLOADED, () => {
        console.log('✅ Update downloaded! Ready to install.');
        setIsUpdateReady(true);
        setDownloadProgress(100);
        // Native snackbar is already shown by InAppUpdateManager
        // Optionally show your own custom UI
      }),

      // Update failed
      addUpdateListener(InAppUpdateEvents.UPDATE_FAILED, (data) => {
        console.error('❌ Update failed:', data);
        alert(`Update failed: ${data.message}`);
        setUpdateInfo(null);
        setDownloadProgress(0);
      }),

      // User canceled
      addUpdateListener(InAppUpdateEvents.UPDATE_CANCELED, () => {
        console.warn('⚠️ User canceled update');
        setUpdateInfo(null);
        setDownloadProgress(0);
      }),

      // Installing
      addUpdateListener(InAppUpdateEvents.UPDATE_INSTALLING, () => {
        console.log('⚙️ Installing update...');
      }),

      // Installed
      addUpdateListener(InAppUpdateEvents.UPDATE_INSTALLED, () => {
        console.log('✅ Update installed successfully!');
        setUpdateInfo(null);
        setIsUpdateReady(false);
      })
    ];

    // Cleanup listeners on unmount
    return () => {
      listeners.forEach(listener => listener.remove());
    };
  }, []);

  // Optional: Show custom notification for flexible updates
  const showFlexibleUpdateNotification = (version) => {
    // You can show a custom banner/toast here
    console.log(`New version ${version} is downloading in the background...`);
  };

  // Optional: Manual update check button
  const handleManualUpdateCheck = async () => {
    try {
      console.log('Checking for updates...');
      await checkForUpdate();
    } catch (error) {
      console.error('Failed to check for update:', error);
    }
  };

  // Optional: Manual restart for flexible updates
  const handleCompleteUpdate = async () => {
    try {
      console.log('Restarting app to install update...');
      await completeUpdate();
    } catch (error) {
      console.error('Failed to complete update:', error);
    }
  };

  // Optional: Render custom update UI
  return (
    <div className="update-manager">
      {/* Optional: Manual check button (for testing) */}
      {__DEV__ && (
        <button onClick={handleManualUpdateCheck}>
          Check for Updates
        </button>
      )}

      {/* Optional: Download progress indicator */}
      {updateInfo?.type === UpdateType.FLEXIBLE && downloadProgress > 0 && downloadProgress < 100 && (
        <div className="update-progress">
          <p>Downloading update: {downloadProgress}%</p>
          <progress value={downloadProgress} max="100" />
        </div>
      )}

      {/* Optional: Custom restart button (in addition to native snackbar) */}
      {isUpdateReady && (
        <div className="update-ready">
          <p>Update downloaded! Restart to install.</p>
          <button onClick={handleCompleteUpdate}>
            Restart Now
          </button>
        </div>
      )}
    </div>
  );
};

export default UpdateManager;

/**
 * ==========================================
 * SIMPLE INTEGRATION (Minimal Setup)
 * ==========================================
 * 
 * If you don't need custom UI, just add this to App.js:
 */

// In App.js - Simple version
import { useEffect } from 'react';
import { 
  addUpdateListener, 
  InAppUpdateEvents 
} from './plugins/inAppUpdatePlugin';

function App() {
  useEffect(() => {
    // Basic logging for update events
    const listeners = [
      addUpdateListener(InAppUpdateEvents.UPDATE_AVAILABLE, (data) => {
        console.log('Update available:', data.updateType);
      }),
      addUpdateListener(InAppUpdateEvents.UPDATE_DOWNLOADING, (data) => {
        console.log('Downloading:', data.progress + '%');
      }),
      addUpdateListener(InAppUpdateEvents.UPDATE_DOWNLOADED, () => {
        console.log('Update ready! (Snackbar shown by native)');
      })
    ];

    return () => listeners.forEach(l => l.remove());
  }, []);

  return (
    // Your app content
  );
}

/**
 * ==========================================
 * NOTES
 * ==========================================
 * 
 * 1. UPDATE CHECK TIMING:
 *    - Automatic: Checks on app launch (2 second delay)
 *    - Manual: Call checkForUpdate() anytime
 * 
 * 2. IMMEDIATE UPDATES:
 *    - Google Play shows full-screen blocking UI
 *    - No need for custom UI
 *    - User must update to continue
 * 
 * 3. FLEXIBLE UPDATES:
 *    - Native snackbar shown automatically when ready
 *    - Can add custom UI if desired
 *    - User can continue using app during download
 * 
 * 4. PRODUCTION READY:
 *    - All update logic handled by native code
 *    - JavaScript listeners are optional
 *    - Works without any frontend changes
 * 
 * 5. TESTING:
 *    - Must test on real device with Play Store
 *    - Internal test track recommended
 *    - See ANDROID_IN_APP_UPDATES_GUIDE.md for details
 */
