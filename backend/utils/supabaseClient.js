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
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istTime = new Date(now.getTime() + istOffset);
  // Format as PostgreSQL timestamp without timezone
  return istTime.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23);
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
