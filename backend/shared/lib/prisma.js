import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

/**
 * Prisma client for MySQL/MariaDB.
 * Table queries from getMysqlClient() go through this client.
 * MYSQL_DATABASE_URL is required.
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
