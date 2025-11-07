/**
 * Custom React Hook for Camera Monitoring
 * 
 * Usage:
 * ```javascript
 * import { useCameraMonitoring } from './examples/useCameraMonitoring';
 * 
 * function MyComponent() {
 *   const { isActive, isLoading, toggle } = useCameraMonitoring();
 *   
 *   return (
 *     <button onClick={toggle} disabled={isLoading}>
 *       {isActive ? 'Stop' : 'Start'} Camera Monitoring
 *     </button>
 *   );
 * }
 * ```
 */

import { useState, useEffect } from 'react';
import { CameraMonitorPlugin } from '../plugins/cameraMonitorPlugin';
import { Capacitor } from '@capacitor/core';

export function useCameraMonitoring() {
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check initial status when hook mounts
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      setIsLoading(true);
      const { isRunning } = await CameraMonitorPlugin.isMonitoring();
      setIsActive(isRunning);
      setError(null);
    } catch (err) {
      setError(err);
      console.error('Failed to check camera monitoring status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const start = async () => {
    if (!Capacitor.isNativePlatform()) {
      setError(new Error('Not supported on web'));
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);
      await CameraMonitorPlugin.startMonitoring();
      setIsActive(true);
      return true;
    } catch (err) {
      setError(err);
      console.error('Failed to start camera monitoring:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const stop = async () => {
    if (!Capacitor.isNativePlatform()) {
      setError(new Error('Not supported on web'));
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);
      await CameraMonitorPlugin.stopMonitoring();
      setIsActive(false);
      return true;
    } catch (err) {
      setError(err);
      console.error('Failed to stop camera monitoring:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const toggle = async () => {
    return isActive ? await stop() : await start();
  };

  return {
    isActive,
    isLoading,
    error,
    start,
    stop,
    toggle,
    refresh: checkStatus,
  };
}
