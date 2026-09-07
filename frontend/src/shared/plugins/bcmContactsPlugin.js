/**
 * bcmContactsPlugin.js — Capacitor bridge to native BcmContactsPlugin (Android).
 * iOS / web have no native implementation; callers must fall back.
 */
import { registerPlugin } from '@capacitor/core';

const BcmContacts = registerPlugin('BcmContacts');

export default BcmContacts;
