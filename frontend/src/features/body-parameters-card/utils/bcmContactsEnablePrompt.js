/**
 * bcmContactsEnablePrompt.js
 * Imperative Contacts-enable confirmation for BCM (survives form unmount).
 */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import * as PermissionManager from '../../../shared/services/permissionManager.js';
import BcmContactsEnableModal from '../components/BcmContactsEnableModal.jsx';

const NEVER_ASK_KEY = 'wv.bcm.contacts.neverAsk';

export function isBcmContactsNeverAsk() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(NEVER_ASK_KEY) === '1';
  } catch {
    return false;
  }
}

export function setBcmContactsNeverAsk(value) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (value) localStorage.setItem(NEVER_ASK_KEY, '1');
    else localStorage.removeItem(NEVER_ASK_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Wait until Contacts is granted after returning from Settings, or timeout.
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
async function waitUntilContactsGranted(timeoutMs = 180000) {
  if (!Capacitor.isNativePlatform()) return false;

  const check = async () => {
    const { granted, status } = await PermissionManager.checkPermission('contacts');
    return Boolean(granted || status === 'limited');
  };

  if (await check()) return true;

  return new Promise((resolve) => {
    let done = false;
    let listener;
    const finish = async (ok) => {
      if (done) return;
      done = true;
      try {
        await listener?.remove?.();
      } catch {
        /* ignore */
      }
      resolve(Boolean(ok));
    };

    const timer = setTimeout(() => {
      void finish(false);
    }, timeoutMs);

    CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) return;
      if (await check()) {
        clearTimeout(timer);
        await finish(true);
      }
    }).then((handle) => {
      listener = handle;
    }).catch(() => {
      clearTimeout(timer);
      void finish(false);
    });
  });
}

/**
 * Request permission when possible; otherwise open Settings and wait for grant.
 * @returns {Promise<boolean>} true if Contacts is granted
 */
export async function tryEnableContactsPermission() {
  const before = await PermissionManager.checkPermission('contacts');
  if (before.granted || before.status === 'limited') return true;

  // Always try request once — Android first-install often reports denied incorrectly.
  const result = await PermissionManager.requestPermission('contacts');
  if (result.granted || result.status === 'limited') return true;

  const after = await PermissionManager.checkPermission('contacts');
  if (after.granted || after.status === 'limited') return true;

  // User denied but OS can still prompt later — skip Settings wait; ask next BCM save.
  if (after.canRequest) return false;

  // Permanently blocked — Settings is the only path.
  await PermissionManager.openAppSettings();
  return waitUntilContactsGranted();
}

/**
 * Show enable-contacts confirmation. Resolves with user decision + grant result.
 * @returns {Promise<{ action: 'enable'|'dismiss', neverAsk: boolean, granted?: boolean }>}
 */
export function promptBcmContactsEnable() {
  if (typeof document === 'undefined') {
    return Promise.resolve({ action: 'dismiss', neverAsk: false, granted: false });
  }

  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.setAttribute('data-bcm-contacts-prompt', '1');
    document.body.appendChild(host);
    const root = createRoot(host);

    const finish = (result) => {
      try {
        root.unmount();
      } catch {
        /* ignore */
      }
      try {
        host.remove();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    function PromptBridge() {
      const [enabling, setEnabling] = useState(false);

      return (
        <BcmContactsEnableModal
          enabling={enabling}
          onDismiss={(neverAsk) => {
            if (neverAsk) setBcmContactsNeverAsk(true);
            finish({ action: 'dismiss', neverAsk: Boolean(neverAsk), granted: false });
          }}
          onEnable={async () => {
            setEnabling(true);
            try {
              const granted = await tryEnableContactsPermission();
              finish({ action: 'enable', neverAsk: false, granted });
            } catch {
              finish({ action: 'enable', neverAsk: false, granted: false });
            }
          }}
        />
      );
    }

    root.render(<PromptBridge />);
  });
}
