// src/config/api.js
/**
 * API Configuration
 * For production builds (APK), hardcode the production URL
 * For development, use environment variables
 */

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://wellness-buddy-pwa-eta.vercel.app';
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || 'AIzaSyCxYzpvuRrgcPFAljbDDzL1FVQEOB3qpDI';

// Debug logging
console.log('🔧 API Config Loaded:', {
  API_BASE_URL,
  hasGeminiKey: !!GEMINI_API_KEY,
  env: process.env.NODE_ENV
});

export { API_BASE_URL, GEMINI_API_KEY };
