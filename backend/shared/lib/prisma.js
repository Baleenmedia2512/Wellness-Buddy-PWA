import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

/**
 * Prisma client for local MySQL database wellness_schema_check.
 * Used when MYSQL_DATABASE_URL is set. Table queries from getSupabaseClient()
 * go through this client. Supabase remains the table client when the variable is absent.
 * @returns {PrismaClient}
 */
export function getPrisma() {
  const url = process.env.MYSQL_DATABASE_URL;
  if (!url) {
    throw new Error('MYSQL_DATABASE_URL is not set');
  }

  if (!globalForPrisma.__wellnessPrisma) {
    globalForPrisma.__wellnessPrisma = new PrismaClient({
      datasources: { db: { url } },
    });
  }

  return globalForPrisma.__wellnessPrisma;
}
