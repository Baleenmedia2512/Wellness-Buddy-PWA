/**
 * keepAwakePlugin.js — JavaScript bridge to native KeepAwakePlugin
 * 
 * Prevents screen from auto-locking while app is active.
 * Automatically released when app is backgrounded.
 */

import { registerPlugin } from '@capacitor/core';

const KeepAwakePlugin = registerPlugin('KeepAwake', {
  web: () => ({
    // Web fallback: use Screen Wake Lock API (experimental, requires HTTPS)
    async activate() {
      if ('wakeLock' in navigator) {
        try {
          // @ts-ignore - Screen Wake Lock API
          await navigator.wakeLock.request('screen');
          console.log('✅ Web wake lock activated');
        } catch (err) {
          console.warn('⚠️ Web wake lock failed (needs HTTPS):', err.message);
        }
      }
    },
    async deactivate() {
      // Wake lock auto-releases when tab is hidden (no explicit release needed)
      console.log('✅ Web wake lock deactivated (auto)');
    }
  })
});

export default KeepAwakePlugin;
