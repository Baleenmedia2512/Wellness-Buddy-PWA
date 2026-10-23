/**
 * Database client used by repositories.
 * MYSQL_DATABASE_URL sends table reads and writes to local MySQL through Prisma.
 * File storage and the live race channel still use Supabase when SUPABASE_URL is set.
 */

import { createClient } from '@supabase/supabase-js';

let supabaseInstance = null;
let mysqlAdapter = null;

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

function getOptionalSupabase() {
  const url = process.env.SUPABASE_URL;
  if (!url || !/^https:\/\/.*\.supabase\.co\/?$/.test(url)) return null;
  const { key } = resolveSupabaseKey();
  if (!key) return null;
  if (!supabaseInstance) supabaseInstance = createClient(url, key);
  return supabaseInstance;
}

if (process.env.MYSQL_DATABASE_URL) {
  const { createMysqlSupabaseClient } = await import('../shared/lib/mysql/mysqlSupabaseClient.js');
  const { createLocalFileStorage } = await import('../shared/lib/testimonial-files/localFileStorage.js');
  const storageClient = getOptionalSupabase();
  mysqlAdapter = createMysqlSupabaseClient({
    storage: storageClient?.storage || createLocalFileStorage(),
    channel: storageClient ? (name, options) => storageClient.channel(name, options) : null,
  });
  console.log('MySQL Prisma client initialized for table queries');
}

/**
 * Get the active table client.
 * @returns {Object} Supabase-shaped client backed by MySQL or Supabase
 */
export function getSupabaseClient() {
  if (mysqlAdapter) return mysqlAdapter;

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
