import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { debugLog } from './logger.js';

// Dynamic plugin loading for Android
const initializeEdgeToEdgePlugins = async () => {
  if (Capacitor.getPlatform() === 'android') {
    try {
      // First set the status bar style to ensure proper initialization
      await StatusBar.setStyle({ style: Style.Light });
      
      // Then configure edge-to-edge support
      const { EdgeToEdgeSupport } = await import('@capawesome/capacitor-android-edge-to-edge-support');
      await EdgeToEdgeSupport.enable({
        statusBarColor: '#FFFFFF',
        statusBarStyle: 'light',
        navigationBarColor: '#FFFFFF',
        navigationBarStyle: 'light',
        statusBarOverlay: false // Ensure no overlay issues
      });

      // Finally configure navigation bar
      const { NavigationBar } = await import('@capgo/capacitor-navigation-bar');
      await NavigationBar.setColor({
        color: '#FFFFFF',
        darkButtons: true
      });

      debugLog('✅ Mobile UI initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing mobile UI:', error);
    }
  }
};