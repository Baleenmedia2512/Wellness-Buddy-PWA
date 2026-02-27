import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import WellnessValleyApp from './App';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

// ✅ CRITICAL FIX: Explicitly hide splash screen to prevent text selection overlay issue
if (Capacitor.isNativePlatform()) {
  // Hide splash screen immediately to remove window layer
  SplashScreen.hide().catch(err => {
    console.warn('Splash screen already hidden:', err);
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));

// ✅ ANDROID PERFORMANCE: Disable StrictMode in production for faster rendering
if (process.env.NODE_ENV === 'production') {
  root.render(<WellnessValleyApp />);
} else {
  root.render(
    <React.StrictMode>
      <WellnessValleyApp />
    </React.StrictMode>
  );
}

// ✅ PWA: Register service worker with update detection
// Works in both web and Android (when built with 'npm run build')
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    console.log('🔧 [PWA] Environment:', {
      isNative: Capacitor.isNativePlatform(),
      platform: Capacitor.getPlatform(),
      nodeEnv: process.env.NODE_ENV
    });
    
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('✅ [PWA] Service Worker registered successfully');
        console.log('   Scope:', registration.scope);
        console.log('   Platform:', Capacitor.isNativePlatform() ? 'Android APK' : 'Web');
        
        // Listen for update notifications from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'SW_UPDATED') {
            console.log('🔄 [PWA] New version detected:', event.data.version);
            console.log('✅ [PWA] Auto-reloading to apply updates...');
            
            // Silently reload to apply new version (no popup)
            setTimeout(() => {
              window.location.reload();
            }, 1000); // Small delay to ensure service worker is ready
          }
        });
        
        // Detect when new service worker is waiting
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('🔄 [PWA] Update found, installing new version...');
          
          newWorker.addEventListener('statechange', () => {
            console.log('📝 [PWA] Service Worker state:', newWorker.state);
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('✅ [PWA] New version installed and ready!');
            }
          });
        });
        
        // Check for updates periodically (every 5 minutes)
        setInterval(() => {
          console.log('🔍 [PWA] Checking for updates...');
          registration.update();
        }, 5 * 60 * 1000); // Check every 5 minutes
      })
      .catch((error) => {
        console.error('❌ [PWA] Service Worker registration failed:');
        console.error('   Error:', error.message);
        console.error('   This is normal in development mode');
      });
  });
} else {
  if (!('serviceWorker' in navigator)) {
    console.warn('⚠️ [PWA] Service Workers not supported in this browser');
  } else {
    console.log('ℹ️ [PWA] Service Worker disabled (development mode)');
  }
}
