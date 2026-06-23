/**
 * Supabase Client Singleton
 * Used for REST API queries (works through firewalls/NAT)
 */

import { createClient } from '@supabase/supabase-js';

let supabaseInstance = null;

/**
 * Get current timestamp in IST (UTC+5:30) for database insertion
 * Database uses "timestamp without time zone" so we need to provide local time
 * @returns {string} ISO timestamp string adjusted to IST
 */
export function getISTTimestamp() {
  const now = new Date();
  const serverUTC = now.toISOString();
  
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istTime = new Date(now.getTime() + istOffset);
  const result = istTime.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23);
  
  // 🔍 DEBUG: Show IST calculation
  console.log('🕐 IST Timestamp Calculation:', {
    serverUTC,
    calculatedIST: result,
    serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    note: 'Server time → IST conversion'
  });
  
  // Format as PostgreSQL timestamp without timezone
  return result;
}

/**
 * Convert any timestamp (from user's device) to IST
 * @param {string|Date} timestamp - Timestamp from user's device (any timezone)
 * @returns {Object} IST timestamp and time components
 */
export function convertToIST(timestamp) {
  const deviceTime = new Date(timestamp);
  
  // Get the UTC time (universal)
  const utcTime = deviceTime.getTime();
  
  // IST is UTC+5:30 (5.5 hours ahead of UTC)
  const istOffsetMs = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  
  // Add IST offset to UTC time to get IST
  const istTime = new Date(utcTime + istOffsetMs);
  
  // Format as PostgreSQL timestamp (without timezone info)
  const istTimestampStr = istTime.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23);
  const istTimeOnly = istTime.toISOString().substring(11, 19); // HH:MM:SS
  
  console.log('🌍 Timezone Conversion to IST:', {
    originalInput: timestamp,
    deviceTime: deviceTime.toISOString(),
    utcTime: new Date(utcTime).toISOString(),
    istTime: istTime.toISOString(),
    istTimestamp: istTimestampStr,
    istTimeOnly: istTimeOnly,
    note: 'Converted to IST (UTC+5:30) for database storage'
  });
  
  return {
    istTimestamp: istTimestampStr,
    istTimeOnly: istTimeOnly,
    istDate: istTime,
    originalDeviceTime: deviceTime.toISOString()
  };
}

/**
 * Get or create Supabase client
 * @returns {Object} Supabase client instance
 */
export function getSupabaseClient() {
  if (!supabaseInstance) {
    const url = process.env.SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_KEY) must be set',
      );
    }

    supabaseInstance = createClient(url, key);

    console.log('✅ Supabase REST client initialized', {
      auth: process.env.SUPABASE_SERVICE_KEY ? 'service_role' : 'anon',
    });
  }

  return supabaseInstance;
}

export default getSupabaseClient;
