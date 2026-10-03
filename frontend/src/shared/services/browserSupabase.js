/**
 * Browser Supabase client (anon key only) for Realtime Broadcast.
 * No-ops when REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY are missing.
 */
import { createClient } from '@supabase/supabase-js';

let client = null;

export function getBrowserSupabase() {
  if (client) return client;
  const url = String(process.env.REACT_APP_SUPABASE_URL || '').trim();
  const anon = String(process.env.REACT_APP_SUPABASE_ANON_KEY || '').trim();
  if (!url || !/^https:\/\/.*\.supabase\.co\/?$/.test(url)) return null;
  if (!anon || !anon.startsWith('eyJ')) return null;
  client = createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      params: { eventsPerSecond: 5 },
    },
  });
  return client;
}

export function isBrowserSupabaseConfigured() {
  return getBrowserSupabase() != null;
}
