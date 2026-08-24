import React from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Download, RefreshCw } from 'lucide-react';
import APP_VERSION from '../../config/version.js';

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
 */
export default function AppVersionHardBlock({ policy }) {
  const message =
    policy?.messages?.required
    || 'Please update Wellness Valley to the latest version to continue.';
  const storeUrl = policy?.storeUrl;

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-emerald-100 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <Download className="h-8 w-8 text-emerald-700" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Update required</h1>
        <p className="text-sm text-gray-600 mb-1">{message}</p>
        <p className="text-xs text-gray-400 mb-6">
          Your version: v{APP_VERSION.VERSION}
          {policy?.effectiveMinVersion ? ` · Required: v${policy.effectiveMinVersion}+` : ''}
        </p>
        <button
          type="button"
          onClick={() => openStoreUrl(storeUrl)}
          className="w-full rounded-xl bg-emerald-600 py-3.5 text-white font-semibold shadow-md hover:bg-emerald-700 transition-colors"
        >
          Update from Store
        </button>
      </div>
    </div>
  );
}

export function AppVersionUpdateBanner({ policy, onDismiss }) {
  const message =
    policy?.messages?.recommended
    || 'A new version is available with improvements and fixes.';
  const storeUrl = policy?.storeUrl;

  return (
    <div className="fixed top-0 left-0 right-0 z-[15000] px-3 pt-2 pb-1 pointer-events-none">
      <div className="mx-auto max-w-lg pointer-events-auto rounded-xl border border-amber-200 bg-amber-50 shadow-md px-3 py-2.5 flex items-start gap-2">
        <RefreshCw className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-900">Update available</p>
          <p className="text-[11px] text-amber-800 leading-snug">{message}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => openStoreUrl(storeUrl)}
              className="text-[11px] font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg px-3 py-1.5"
            >
              Update
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="text-[11px] font-medium text-amber-800 hover:text-amber-900 px-2 py-1.5"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
