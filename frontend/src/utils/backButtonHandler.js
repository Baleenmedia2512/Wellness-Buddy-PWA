import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

let backButtonCounter = 0;
let backButtonTimeout;

export const initializeBackButton = (goBack, showToast, isMainPage) => {
  if (Capacitor.getPlatform() !== 'android') return;

  App.addListener('backButton', () => {
    // Clear any existing timeout
    if (backButtonTimeout) {
      clearTimeout(backButtonTimeout);
    }

    // If not on main page, always try to navigate back first
    if (!isMainPage) {
      goBack();
      return;
    }

    // Only show exit dialog on main page
    handleExitDialog(showToast);
  });
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
  
  // Remove the back button listener when component unmounts
  App.removeAllListeners();
  if (backButtonTimeout) {
    clearTimeout(backButtonTimeout);
  }
};