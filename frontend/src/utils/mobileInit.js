import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

// Dynamic plugin loading for Android
const initializeEdgeToEdgePlugins = async () => {
  if (Capacitor.getPlatform() === 'android') {
    try {
      const { EdgeToEdgeSupport } = await import('@capawesome/capacitor-android-edge-to-edge-support');
      const { NavigationBar } = await import('@capgo/capacitor-navigation-bar');
      
      // Configure edge-to-edge support
      await EdgeToEdgeSupport.enable({
        statusBarColor: '#f8fafc', // Light gray background
        statusBarStyle: 'light', // 'light' means dark icons on light background
        navigationBarColor: '#ffffff',
        navigationBarStyle: 'light'
      });

      // Set status bar style (dark icons on light background)
      await StatusBar.setStyle({ style: Style.Light });

      console.log('✅ Mobile UI initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing mobile UI:', error);
    }
  }
};