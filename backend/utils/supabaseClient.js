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
  
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const utcTime = deviceTime.getTime();
  const istTime = new Date(utcTime + istOffset - (deviceTime.getTimezoneOffset() * 60 * 1000));
  
  // Format as PostgreSQL timestamp
  const istTimestampStr = istTime.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23);
  const istTimeOnly = istTime.toISOString().substring(11, 19); // HH:MM:SS
  
  console.log('🌍 Timezone Conversion:', {
    deviceTime: deviceTime.toISOString(),
    deviceTimezone: `UTC${deviceTime.getTimezoneOffset() / -60}`,
    convertedIST: istTimestampStr,
    istTimeOnly: istTimeOnly
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
    if (!process.env.SUPABASE_ANON_KEY) {
      throw new Error('SUPABASE_ANON_KEY is not set in environment variables');
    }
    
    supabaseInstance = createClient(
      process.env.SUPABASE_URL || 'https://lnvvaeudhtazvxtmifeg.supabase.co',
      process.env.SUPABASE_ANON_KEY
    );
    
    console.log('✅ Supabase REST client initialized');
  }
  
  return supabaseInstance;
}

export default getSupabaseClient;
