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
