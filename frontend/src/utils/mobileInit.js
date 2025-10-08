import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';

// Dynamic plugin loading for Android
export const initializeMobileUI = async () => {
  if (Capacitor.getPlatform() === 'android') {
    try {
      const { EdgeToEdgeSupport } = await import('@capawesome/capacitor-android-edge-to-edge-support');
      const { NavigationBar } = await import('@capgo/capacitor-navigation-bar');
      
      // Configure edge-to-edge support
      await EdgeToEdgeSupport.enable({
        statusBarColor: '#f8fafc',
        statusBarStyle: 'light',
        navigationBarColor: '#ffffff',
        navigationBarStyle: 'light'
      });

      // Configure status bar
      await StatusBar.setStyle({ style: 'LIGHT' });
      
      // Configure navigation bar
      await NavigationBar.setColor({
        color: '#ffffff',
        darkButtons: true
      });

      console.log('✅ Mobile UI initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing mobile UI:', error);
    }
  }
};