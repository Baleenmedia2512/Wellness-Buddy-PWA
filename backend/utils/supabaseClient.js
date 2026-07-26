/**
 * Supabase Client Singleton
 * Used for REST API queries (works through firewalls/NAT)
 */

import { createClient } from '@supabase/supabase-js';

let supabaseInstance = null;

function isSupabaseJwt(value) {
  return typeof value === 'string' && value.startsWith('eyJ') && value.length > 100;
}

function resolveSupabaseKey() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (isSupabaseJwt(serviceKey)) {
    return { key: serviceKey, auth: 'service_role' };
  }

  if (serviceKey && !isSupabaseJwt(serviceKey)) {
    console.warn(
      '⚠️ SUPABASE_SERVICE_KEY is set but invalid (expected JWT). Falling back to SUPABASE_ANON_KEY.',
    );
  }

  if (isSupabaseJwt(anonKey)) {
    return { key: anonKey, auth: 'anon' };
  }

  return { key: null, auth: null };
}

/**
 * Get or create Supabase client
 * @returns {Object} Supabase client instance
 */
export function getSupabaseClient() {
  if (!supabaseInstance) {
    const url = process.env.SUPABASE_URL;
    const { key, auth } = resolveSupabaseKey();

    if (!url || !/^https:\/\/.*\.supabase\.co\/?$/.test(url)) {
      throw new Error(
        'SUPABASE_URL must be set to https://<project-ref>.supabase.co',
      );
    }

    if (!key) {
      throw new Error(
        'SUPABASE_ANON_KEY (or a valid SUPABASE_SERVICE_KEY JWT) must be set',
      );
    }

    supabaseInstance = createClient(url, key);

    console.log('✅ Supabase REST client initialized', { auth });
  }

  return supabaseInstance;
}

export default getSupabaseClient;
