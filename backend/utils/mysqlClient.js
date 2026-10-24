/**
 * Table client for repositories.
 * Every .from() read and write goes to MySQL through Prisma.
 * MYSQL_DATABASE_URL is required. File storage uses the local file store.
 */
import { createLocalFileStorage } from '../shared/lib/testimonial-files/localFileStorage.js';

let mysqlAdapter = null;

if (process.env.MYSQL_DATABASE_URL) {
  const { createMysqlTableClient } = await import('../shared/lib/mysql/mysqlTableClient.js');
  mysqlAdapter = createMysqlTableClient({
    storage: createLocalFileStorage(),
  });
  console.log('MySQL Prisma client initialized for table queries');
}

/**
 * MySQL table client. Call sites still use .from(table).select().eq().
 * @returns {object}
 */
export function getMysqlClient() {
  if (!mysqlAdapter) {
    throw new Error('MYSQL_DATABASE_URL must be set. Table queries use MySQL through Prisma.');
  }
  return mysqlAdapter;
}

export default getMysqlClient;
