import React from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import wellnessValleyIcon from '../../assets/wellness-valley-icon.png';
import APP_VERSION from '../../config/version.js';
import { getClientPlatform } from '../services/appVersionPolicy.api.js';

const APP_DISPLAY_NAME = 'Wellness Valley';

async function openStoreUrl(url) {
  if (!url) return;
  if (Capacitor.isNativePlatform()) {
    try {
      await App.openUrl({ url });
      return;
    } catch {
      /* fallback */
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Full-screen block when client is below server minimum supported version.
 * Android: Play IMMEDIATE update is started automatically; this screen is a fallback
 * when Play is unavailable. iOS: user must tap Update Now to open the App Store.
 */
export default function AppVersionHardBlock({
  policy,
  onUpdateNow,
  playUnavailable = false,
  androidUpdating = false,
}) {
  const platform = getClientPlatform();
  const message =
    policy?.messages?.required
    || 'A new version of Wellness Valley is available. Please update the app to continue using it.';
  const storeUrl = policy?.storeUrl;

  const handleUpdateNow = () => {
    if (platform === 'android' && onUpdateNow && !playUnavailable) {
      onUpdateNow();
      return;
    }
    openStoreUrl(storeUrl);
  };

  const showAndroidPlayHint = platform === 'android' && androidUpdating && !playUnavailable;
  const showPlayFallback = platform === 'android' && playUnavailable;

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-emerald-100 text-center overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-green-400 to-teal-400 -mx-6 -mt-6 mb-5" />
        <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-2xl overflow-hidden">
          <img
            src={wellnessValleyIcon}
            alt={APP_DISPLAY_NAME}
            draggable="false"
            className="h-full w-full object-contain brand-logo"
            style={{
              WebkitUserSelect: 'none',
              userSelect: 'none',
              WebkitTouchCallout: 'none',
              WebkitUserDrag: 'none',
            }}
          />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">{APP_DISPLAY_NAME}</h1>
        <p className="text-base font-semibold text-gray-900 mb-2">Update Required</p>
        <p className="text-sm text-gray-600 mb-1">{message}</p>
        {showAndroidPlayHint && (
          <p className="text-xs text-emerald-700 mb-2">
            Opening Google Play update…
          </p>
        )}
        {showPlayFallback && (
          <p className="text-xs text-amber-700 mb-2">
            In-app update is unavailable. Use the button below to update from the Play Store.
          </p>
        )}
        <p className="text-xs text-gray-400 mb-6">
          Your version: v{APP_VERSION.VERSION}
          {policy?.effectiveMinVersion ? ` · Required: v${policy.effectiveMinVersion}+` : ''}
          {policy?.latestVersion ? ` · Latest: v${policy.latestVersion}` : ''}
        </p>
        <button
          type="button"
          onClick={handleUpdateNow}
          className="w-full rounded-xl bg-emerald-600 py-3.5 text-white font-semibold shadow-md hover:bg-emerald-700 transition-colors"
        >
          Update Now
        </button>
      </div>
    </div>
  );
}
