import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

let backButtonCounter = 0;
let backButtonTimeout;

// Holds the PluginListenerHandle returned by App.addListener so we can
// remove ONLY the back-button listener on cleanup instead of calling
// App.removeAllListeners(), which would wipe every other Capacitor App
// listener registered by other effects (camera resume, gallery, etc.).
let _backButtonHandle = null;

export const initializeBackButton = (goBack, showToast, isMainPage) => {
  if (Capacitor.getPlatform() !== 'android') return;

  // Remove the previous listener before registering a new one.
  // This is safe to call even if the handle hasn't resolved yet because
  // the previous effect's cleanup runs synchronously before the new effect.
  if (_backButtonHandle) {
    try { _backButtonHandle.remove(); } catch { /* ignore */ }
    _backButtonHandle = null;
  }

  App.addListener('backButton', () => {
    // Clear any existing timeout
    if (backButtonTimeout) {
      clearTimeout(backButtonTimeout);
    }

    // If not on main page, always try to navigate back first.
    if (!isMainPage) {
      goBack();
      return;
    }

    // Only show exit dialog on main page
    handleExitDialog(showToast);
  }).then((handle) => {
    _backButtonHandle = handle;
  }).catch(() => { /* addListener failed — nothing to clean up */ });
};

// Handle double back press to exit
const handleExitDialog = (showToast) => {
  backButtonCounter++;
  
  if (backButtonCounter === 1) {
    showToast('Press back again to exit');
    
    // Reset counter after 2 seconds
    backButtonTimeout = setTimeout(() => {
      backButtonCounter = 0;
    }, 2000);
  } else if (backButtonCounter === 2) {
    App.exitApp();
  }
};

export const cleanupBackButton = () => {
  if (Capacitor.getPlatform() !== 'android') return;

  // Remove ONLY the back-button listener we own.
  // Do NOT call App.removeAllListeners() — that nukes every other
  // Capacitor App listener registered by other effects in App.js
  // (camera auto-resume, gallery monitoring, foreground profile check).
  if (_backButtonHandle) {
    try { _backButtonHandle.remove(); } catch { /* ignore */ }
    _backButtonHandle = null;
  }
  if (backButtonTimeout) {
    clearTimeout(backButtonTimeout);
  }
};