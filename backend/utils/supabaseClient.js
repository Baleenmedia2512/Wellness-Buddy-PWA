/**
 * Supabase Client Singleton
 * Used for REST API queries (works through firewalls/NAT)
 */

import { createClient } from '@supabase/supabase-js';

let supabaseInstance = null;

/**
 * Get or create Supabase client
 * @returns {Object} Supabase client instance
 */
export function getSupabaseClient() {
  if (!supabaseInstance) {
    const url = process.env.SUPABASE_URL;
    console.log("URL:", process.env.SUPABASE_URL);
console.log("Service key exists:", !!process.env.SUPABASE_SERVICE_KEY);
console.log("Anon key exists:", !!process.env.SUPABASE_ANON_KEY);
    const key =
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_ANON_KEY;
      console.log("Key starts with:", key?.substring(0, 20));

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
