import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import WellnessValleyApp from './App';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import { debugLog } from './shared/utils/logger.js';

// ✅ PERFORMANCE: Suppress all console output in production
// In iOS WKWebView, every console.log bridges to native — very expensive
if (process.env.NODE_ENV === 'production') {
  const noop = () => {};
  console.log = noop;
  console.warn = noop;
  console.info = noop;
  console.debug = noop;
  // Keep console.error for critical crash reporting only
}

// ✅ CRITICAL FIX: Explicitly hide splash screen to prevent text selection overlay issue //
if (Capacitor.isNativePlatform()) {
  // Hide splash screen immediately to remove window layer
  SplashScreen.hide().catch(() => {});
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
    debugLog('🔧 [PWA] Environment:', {
      isNative: Capacitor.isNativePlatform(),
      platform: Capacitor.getPlatform(),
      nodeEnv: process.env.NODE_ENV
    });
    
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        debugLog('✅ [PWA] Service Worker registered successfully');
        debugLog('   Scope:', registration.scope);
        debugLog('   Platform:', Capacitor.isNativePlatform() ? 'Android APK' : 'Web');
        
        // Listen for update notifications from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'SW_UPDATED') {
            debugLog('🔄 [PWA] New version detected:', event.data.version);
            debugLog('✅ [PWA] Auto-reloading to apply updates...');
            
            // Silently reload to apply new version (no popup)
            setTimeout(() => {
              window.location.reload();
            }, 1000); // Small delay to ensure service worker is ready
          }
        });
        
        // Detect when new service worker is waiting
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          debugLog('🔄 [PWA] Update found, installing new version...');
          
          newWorker.addEventListener('statechange', () => {
            debugLog('📝 [PWA] Service Worker state:', newWorker.state);
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              debugLog('✅ [PWA] New version installed and ready!');
            }
          });
        });
        
        // Check for updates periodically (every 5 minutes)
        setInterval(() => {
          debugLog('🔍 [PWA] Checking for updates...');
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
    debugLog('ℹ️ [PWA] Service Worker disabled (development mode)');
  }
}
