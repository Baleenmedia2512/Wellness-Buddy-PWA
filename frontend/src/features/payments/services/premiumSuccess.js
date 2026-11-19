import { shouldShowPremiumSuccess } from '../domain/premiumSuccess.rules.js';

const PENDING_KEY = 'wv.premiumSuccessPending';
const listeners = new Set();

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

/** Remember that this member's payment was just confirmed, until they tap Okay. */
export function markPremiumSuccessPending(userId) {
  const id = String(userId ?? '').trim();
  if (!id) return;
  try {
    storage()?.setItem(PENDING_KEY, id);
  } catch {
    // Storage blocked: the popup can still open from the in-memory notice below.
  }
  notify();
}

export function readPremiumSuccessPending() {
  try {
    return storage()?.getItem(PENDING_KEY) || '';
  } catch {
    return '';
  }
}

export function clearPremiumSuccessPending() {
  try {
    storage()?.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
  notify();
}

export function isPremiumSuccessPending(userId) {
  return shouldShowPremiumSuccess(readPremiumSuccessPending(), userId);
}

export function subscribePremiumSuccess(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
