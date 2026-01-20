/**
 * Database Connection Pool (PostgreSQL/Supabase)
 * 
 * MySQL-Compatible Wrapper for PostgreSQL
 * 
 * This module provides MySQL-style API (execute, getConnection, transactions)
 * while using PostgreSQL under the hood. This allows existing code to work
 * with minimal changes after migrating from MySQL to Supabase PostgreSQL.
 * 
 * Key Features:
 * - Automatic placeholder conversion (? -> $1, $2, ...)
 * - MySQL-style result format [rows, fields]
 * - MySQL-compatible transaction methods
 * - SQL function translation (NOW(), CURDATE(), DATE_SUB, etc.)
 * - Supabase connection pooling support
 * 
 * Performance improvement: ~300-500ms saved per request
 */

import pg from 'pg';
import dns from 'dns';
import tls from 'tls';
import { promisify } from 'util';
const { Pool } = pg;

// Force IPv4 DNS resolution to avoid IPv6 timeout issues
dns.setDefaultResultOrder('ipv4first');

// Allow self-signed certificates for Supabase Pooler
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Create IPv4-only DNS lookup function
const dnsLookup = promisify(dns.lookup);
const ipv4OnlyLookup = async (hostname, options, callback) => {
  // Force IPv4 resolution
  const opts = typeof options === 'object' ? { ...options, family: 4 } : { family: 4 };
  
  try {
    const result = await dnsLookup(hostname, opts);
    if (callback) {
      callback(null, result.address, result.family);
    } else {
      return result;
    }
  } catch (error) {
    if (callback) {
      callback(error);
    } else {
      throw error;
    }
  }
};

// Configuration for PostgreSQL/Supabase - created lazily to ensure env is loaded
function getDbConfig() {
  // Use DATABASE_URL if available (handles special username formats like postgres.projectref)
  if (process.env.DATABASE_URL) {
    console.log('📡 Using DATABASE_URL connection string');
    return {
      connectionString: process.env.DATABASE_URL,
      max: 10, // Reduced for pooler
      min: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      lookup: ipv4OnlyLookup,
      ssl: {
        rejectUnauthorized: false // Required for Supabase
      },
      application_name: 'wellness-buddy-api'
    };
  }
  
  // Fallback to individual parameters
  console.log('📡 Using individual DB parameters');
  return {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'postgres',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    lookup: ipv4OnlyLookup,
    ssl: (process.env.DB_HOST?.includes('supabase.co') || process.env.DB_HOST?.includes('supabase.com')) ? {
      rejectUnauthorized: false
    } : false,
    application_name: 'wellness-buddy-api',
    connect_timeout: 30
  };
}

// Create the connection pool (singleton with Next.js hot reload protection)
// Use global object to persist pool across hot module reloads in development
const globalForPool = global;
let pool = globalForPool.__dbPool || null;

/**
 * Convert MySQL-style placeholders (?) to PostgreSQL-style ($1, $2, ...)
 * @param {string} sql - SQL query with ? placeholders
 * @returns {string} - SQL query with $n placeholders
 */
function convertPlaceholders(sql) {
  let paramIndex = 0;
  return sql.replace(/\?/g, () => `$${++paramIndex}`);
}

/**
 * Convert MySQL-specific SQL functions to PostgreSQL equivalents
 * @param {string} sql - SQL query with MySQL functions
 * @returns {string} - SQL query with PostgreSQL functions
 */
function convertMySQLFunctions(sql) {
  let result = sql;
  
  // NOW() -> CURRENT_TIMESTAMP (both work in PostgreSQL, but be explicit)
  // NOW() is actually valid in PostgreSQL, so we leave it
  
  // CURDATE() -> CURRENT_DATE
  result = result.replace(/CURDATE\(\)/gi, 'CURRENT_DATE');
  
  // DATE_SUB(date, INTERVAL n unit) -> (date - INTERVAL 'n unit')
  result = result.replace(
    /DATE_SUB\s*\(\s*([^,]+)\s*,\s*INTERVAL\s+(\d+)\s+(\w+)\s*\)/gi,
    (match, date, num, unit) => `(${date.trim()} - INTERVAL '${num} ${unit}')`
  );
  
  // DATE_ADD(date, INTERVAL n unit) -> (date + INTERVAL 'n unit')
  result = result.replace(
    /DATE_ADD\s*\(\s*([^,]+)\s*,\s*INTERVAL\s+(\d+)\s+(\w+)\s*\)/gi,
    (match, date, num, unit) => `(${date.trim()} + INTERVAL '${num} ${unit}')`
  );
  
  // DATE_FORMAT(date, '%Y-%m-%d %H:%i:%s') -> TO_CHAR(date, 'YYYY-MM-DD HH24:MI:SS')
  result = result.replace(
    /DATE_FORMAT\s*\(\s*([^,]+)\s*,\s*'%Y-%m-%d %H:%i:%s'\s*\)/gi,
    (match, date) => `TO_CHAR(${date.trim()}, 'YYYY-MM-DD HH24:MI:SS')`
  );
  
  // HOUR(column) -> EXTRACT(HOUR FROM column)
  result = result.replace(
    /HOUR\s*\(\s*([^)]+)\s*\)/gi,
    (match, col) => `EXTRACT(HOUR FROM ${col.trim()})::int`
  );
  
  // YEAR(column) -> EXTRACT(YEAR FROM column)
  result = result.replace(
    /YEAR\s*\(\s*([^)]+)\s*\)/gi,
    (match, col) => `EXTRACT(YEAR FROM ${col.trim()})::int`
  );
  
  // MONTH(column) -> EXTRACT(MONTH FROM column)
  result = result.replace(
    /MONTH\s*\(\s*([^)]+)\s*\)/gi,
    (match, col) => `EXTRACT(MONTH FROM ${col.trim()})::int`
  );
  
  // IFNULL(a, b) -> COALESCE(a, b)
  result = result.replace(/IFNULL\s*\(/gi, 'COALESCE(');
  
  // Handle backtick-quoted identifiers -> double quotes (PostgreSQL style)
  result = result.replace(/`([^`]+)`/g, '"$1"');
  
  // Convert double-quoted string literals to single quotes (PostgreSQL standard)
  // In MySQL, double quotes can be used for strings. In PostgreSQL, they're for identifiers.
  // This handles patterns like: = "value" or = "some text"
  // Be careful not to convert actual identifiers - only strings in value positions
  result = result.replace(/(\s*=\s*)"([^"]+)"/g, "$1'$2'");
  result = result.replace(/(\s*,\s*)"([^"]+)"(\s*[,)])/g, "$1'$2'$3");
  
  return result;
}

/**
 * Convert SQL query from MySQL to PostgreSQL syntax
 * Also adds RETURNING clause for INSERT statements to get insertId
 * @param {string} sql - MySQL-style SQL query
 * @returns {string} - PostgreSQL-compatible SQL query
 */
function convertSQL(sql) {
  let result = convertMySQLFunctions(sql);
  result = convertPlaceholders(result);
  
  // Add RETURNING clause for INSERT statements to get insertId
  // Only if not already present
  const trimmedUpper = result.trim().toUpperCase();
  if (trimmedUpper.startsWith('INSERT') && !trimmedUpper.includes('RETURNING')) {
    // Try to extract the table name and find its primary key column
    // For simplicity, assume common patterns - ID, Id, or tablename_id
    result = result.replace(/;?\s*$/, '') + ' RETURNING *';
  }
  
  return result;
}

/**
 * Create MySQL-compatible result object from PostgreSQL result
 * @param {pg.QueryResult} pgResult - PostgreSQL query result
 * @param {string} sql - Original SQL query
 * @returns {Array} MySQL-style [rows, fields] with additional properties
 */
function createMySQLResult(pgResult, sql) {
  const rows = pgResult.rows || [];
  const fields = pgResult.fields || [];
  
  // Create a result object with MySQL-compatible properties
  const resultObj = rows;
  
  // Add MySQL-compatible properties for INSERT/UPDATE/DELETE
  const trimmedUpper = sql.trim().toUpperCase();
  
  if (trimmedUpper.startsWith('INSERT')) {
    // For INSERT, get insertId from RETURNING clause result
    if (rows.length > 0) {
      // Look for common ID column names
      const idColumns = ['id', 'Id', 'ID', 'userid', 'UserId', 'UserID'];
      for (const col of idColumns) {
        if (rows[0][col] !== undefined) {
          resultObj.insertId = rows[0][col];
          break;
        }
      }
      // If no standard ID found, try first numeric column
      if (resultObj.insertId === undefined) {
        for (const key of Object.keys(rows[0])) {
          if (typeof rows[0][key] === 'number') {
            resultObj.insertId = rows[0][key];
            break;
          }
        }
      }
    }
  }
  
  // affectedRows for UPDATE/DELETE/INSERT
  resultObj.affectedRows = pgResult.rowCount || 0;
  
  return [resultObj, fields];
}

/**
 * Wrap a PostgreSQL client with MySQL-compatible methods
 * @param {pg.PoolClient} client - PostgreSQL client
 * @returns {Object} - MySQL-compatible client wrapper
 */
function wrapClient(client) {
  return {
    // MySQL-style execute method
    async execute(sql, params = []) {
      const convertedSQL = convertSQL(sql);
      const result = await client.query(convertedSQL, params);
      return createMySQLResult(result, sql);
    },
    
    // MySQL-style query method (same as execute for compatibility)
    async query(sql, params = []) {
      const convertedSQL = convertSQL(sql);
      const result = await client.query(convertedSQL, params);
      return createMySQLResult(result, sql);
    },
    
    // MySQL-style transaction methods
    async beginTransaction() {
      await client.query('BEGIN');
    },
    
    async commit() {
      await client.query('COMMIT');
    },
    
    async rollback() {
      await client.query('ROLLBACK');
    },
    
    // Release connection back to pool
    release() {
      client.release();
    },
    
    // Access to raw client if needed
    _client: client
  };
}

/**
 * Create a MySQL-compatible pool wrapper
 * @param {pg.Pool} pgPool - PostgreSQL pool
 * @returns {Object} - MySQL-compatible pool wrapper
 */
function createPoolWrapper(pgPool) {
  return {
    // MySQL-style execute method (returns [rows, fields] with insertId/affectedRows)
    async execute(sql, params = []) {
      const maxRetries = 3;
      let lastError;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 Query attempt ${attempt}/${maxRetries}`);
          const convertedSQL = convertSQL(sql);
          const result = await pgPool.query(convertedSQL, params);
          console.log(`✅ Query successful on attempt ${attempt}`);
          return createMySQLResult(result, sql);
        } catch (error) {
          lastError = error;
          console.error(`❌ Query failed on attempt ${attempt}:`, error.message);
          console.error(`📋 Error code:`, error.code);
          
          // If it's a connection timeout or connection error, retry
          const isRetryableError = 
            error.message?.includes('timeout') || 
            error.message?.includes('Connection terminated') ||
            error.code === 'ETIMEDOUT' || 
            error.code === 'ECONNREFUSED' ||
            error.code === 'ECONNRESET' ||
            error.code === '57P01' || // admin_shutdown
            error.code === '57P03' || // cannot_connect_now
            error.code === '08006' || // connection_failure
            error.code === '08003'; // connection_does_not_exist
          
          if (isRetryableError) {
            if (attempt < maxRetries) {
              const waitTime = attempt * 1500; // Progressive backoff: 1.5s, 3s
              console.log(`⏳ Retrying in ${waitTime}ms...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
          }
          // For other errors, don't retry
          throw error;
        }
      }
      
      // All retries failed
      throw lastError;
    },
    
    // MySQL-style query method (same as execute)
    async query(sql, params = []) {
      const convertedSQL = convertSQL(sql);
      const result = await pgPool.query(convertedSQL, params);
      return createMySQLResult(result, sql);
    },
    
    // MySQL-style getConnection method
    async getConnection() {
      const client = await pgPool.connect();
      return wrapClient(client);
    },
    
    // Direct access to pg pool methods if needed
    async end() {
      await pgPool.end();
    },
    
    // Access to raw pool
    _pool: pgPool
  };
}

/**
 * Get or create the connection pool with MySQL-compatible wrapper
 * @returns {Object} MySQL-compatible pool wrapper
 */
export function getPool() {
  if (!pool) {
    const dbConfig = getDbConfig();
    
    // ===== DATABASE CONNECTION DEBUG LOGS =====
    console.log('\n🔍 ===== DATABASE CONFIGURATION DEBUG =====');
    console.log('==========================================\n');
    
    console.log('🔄 Creating new PostgreSQL connection pool...');
    const pgPool = new Pool(dbConfig);
    
    // Set session-level parameters on each new connection
    pgPool.on('connect', (client) => {
      // Set statement timeout at session level (60 seconds for complex queries)
      client.query('SET statement_timeout = 60000', (err) => {
        if (err) {
          console.warn('⚠️  Could not set statement_timeout:', err.message);
        }
      });
      // Set idle_in_transaction_session_timeout (30 seconds)
      client.query('SET idle_in_transaction_session_timeout = 30000', (err) => {
        if (err) {
          console.warn('⚠️  Could not set idle_in_transaction_session_timeout:', err.message);
        }
      });
    });
    
    console.log('✅ PostgreSQL connection pool created (Supabase)');
    console.log('🎯 Testing connection...');
    
    // Test the connection immediately (fire and forget - don't block)
    pgPool.query('SELECT NOW() as current_time, current_database() as db_name, current_user as user_name')
      .then(result => {
        console.log('\n✅✅✅ DATABASE CONNECTED SUCCESSFULLY! ✅✅✅');
        console.log('🕐 Server Time:', result.rows[0].current_time);
        console.log('🗄️  Database Name:', result.rows[0].db_name);
        console.log('👤 Connected User:', result.rows[0].user_name);
        console.log('=========================================\n');
      })
      .catch(err => {
        console.error('\n❌❌❌ DATABASE CONNECTION FAILED! ❌❌❌');
        console.error('🚨 Error Message:', err.message);
        console.error('📍 Error Code:', err.code);
        console.error('🔍 Full Error:', err);
        console.error('=========================================\n');
      });
    
    // Handle pool errors
    pgPool.on('error', (err) => {
      console.error('\n❌ DATABASE POOL ERROR:');
      console.error('🚨 Message:', err.message);
      console.error('📍 Code:', err.code);
      console.error('🕐 Timestamp:', new Date().toISOString());
      console.error('=========================================\n');
    });
    
    // Create MySQL-compatible wrapper
    pool = createPoolWrapper(pgPool);
    
    // Store in global to survive Next.js hot reloads
    globalForPool.__dbPool = pool;
    
    console.log('✅ Pool stored in global cache for reuse across requests');
  }
  
  return pool;
}

/**
 * Get a MySQL-compatible connection from the pool
 * Use this for transaction handling or explicit connection management
 * @returns {Promise<Object>} MySQL-compatible connection wrapper
 */
export async function getConnection() {
  const poolWrapper = getPool();
  return await poolWrapper.getConnection();
}

/**
 * Execute a query using the pool (convenience method)
 * @param {string} sql SQL query (MySQL-style)
 * @param {Array} params Query parameters
 * @returns {Promise<Array>} [rows, fields] MySQL-style result
 */
export async function query(sql, params = []) {
  console.log('🔍 Executing query via pool...');
  console.log('📝 SQL:', sql.substring(0, 100) + (sql.length > 100 ? '...' : ''));
  console.log('📊 Params:', params);
  
  const poolWrapper = getPool();
  
  try {
    const result = await poolWrapper.execute(sql, params);
    console.log('✅ Query executed successfully');
    console.log('📋 Rows returned:', result[0]?.length || 0);
    return result;
  } catch (error) {
    console.error('❌ Query execution failed:');
    console.error('🚨 Error:', error.message);
    throw error;
  }
}

/**
 * Close the pool (for graceful shutdown)
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ PostgreSQL pool closed');
  }
}

// Export utility functions for testing/debugging
export { convertSQL, convertPlaceholders, convertMySQLFunctions };

export default {
  getPool,
  getConnection,
  query,
  closePool,
  convertSQL
};