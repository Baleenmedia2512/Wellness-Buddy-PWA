/**
 * Supabase Connection Diagnostic Tool
 * Tests both port 5432 and 6543 to determine which works
 */

const pg = require('pg');
const dns = require('dns');
const { promisify } = require('util');
require('dotenv').config();

const dnsLookup = promisify(dns.lookup);

// Force IPv4
dns.setDefaultResultOrder('ipv4first');

const ipv4OnlyLookup = async (hostname, options, callback) => {
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

async function testConnection(port, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Testing ${description} (Port ${port})`);
  console.log('='.repeat(60));

  const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: port,
    connectionTimeoutMillis: 10000,
    lookup: ipv4OnlyLookup,
    ssl: {
      rejectUnauthorized: false
    }
  };

  console.log(`📋 Host: ${config.host}`);
  console.log(`👤 User: ${config.user}`);
  console.log(`🗄️  Database: ${config.database}`);
  console.log(`🔌 Port: ${config.port}`);

  const pool = new pg.Pool(config);
  const startTime = Date.now();

  try {
    console.log('⏳ Attempting connection...');
    const client = await pool.connect();
    const elapsed = Date.now() - startTime;
    
    console.log(`✅ Connection successful! (${elapsed}ms)`);
    
    // Test query
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Query executed successfully');
    console.log('📊 Database time:', result.rows[0].current_time);
    console.log('🔧 PostgreSQL version:', result.rows[0].pg_version.split(',')[0]);
    
    // Test team_table access
    try {
      const tableTest = await client.query(`
        SELECT COUNT(*) as count 
        FROM team_table 
        LIMIT 1
      `);
      console.log('✅ team_table accessible, row count:', tableTest.rows[0].count);
    } catch (tableError) {
      console.log('⚠️  team_table not accessible:', tableError.message);
    }
    
    client.release();
    return true;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`❌ Connection failed after ${elapsed}ms`);
    console.log('❌ Error:', error.message);
    console.log('❌ Code:', error.code);
    if (error.errno) console.log('❌ Errno:', error.errno);
    return false;
  } finally {
    await pool.end();
  }
}

async function runDiagnostics() {
  console.log('\n🔍 SUPABASE CONNECTION DIAGNOSTICS');
  console.log('='.repeat(60));
  console.log('Environment Variables:');
  console.log('  DB_HOST:', process.env.DB_HOST);
  console.log('  DB_USER:', process.env.DB_USER);
  console.log('  DB_NAME:', process.env.DB_NAME);
  console.log('  DB_PASS:', process.env.DB_PASS ? '****** (SET)' : 'NOT SET');
  console.log('  DB_PORT:', process.env.DB_PORT);

  // DNS Resolution Test
  console.log('\n🌐 DNS Resolution Test:');
  try {
    const result = await dnsLookup(process.env.DB_HOST, { family: 4 });
    console.log(`✅ ${process.env.DB_HOST} resolves to ${result.address}`);
  } catch (error) {
    console.log('❌ DNS resolution failed:', error.message);
    return;
  }

  // Test both ports
  const port5432Works = await testConnection(5432, 'Direct Connection (Session Mode)');
  const port6543Works = await testConnection(6543, 'PgBouncer (Transaction Mode)');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Port 5432 (Direct): ${port5432Works ? '✅ WORKS' : '❌ FAILED'}`);
  console.log(`Port 6543 (PgBouncer): ${port6543Works ? '✅ WORKS' : '❌ FAILED'}`);
  
  if (!port5432Works && !port6543Works) {
    console.log('\n⚠️  BOTH PORTS FAILED - Possible issues:');
    console.log('   1. Database is paused (Supabase free tier)');
    console.log('   2. Firewall blocking connections');
    console.log('   3. IP restrictions enabled in Supabase');
    console.log('   4. Wrong credentials');
    console.log('   5. Network issues');
    console.log('\n💡 Next steps:');
    console.log('   1. Check Supabase dashboard - database might be paused');
    console.log('   2. Disable IP restrictions in Supabase settings');
    console.log('   3. Try from a different network');
  } else if (port5432Works) {
    console.log('\n✅ RECOMMENDED: Use port 5432 in your .env file');
  } else if (port6543Works) {
    console.log('\n✅ RECOMMENDED: Use port 6543 in your .env file');
    console.log('⚠️  Note: Transaction mode has limitations (no LISTEN/NOTIFY, etc.)');
  }
  
  console.log('\n' + '='.repeat(60));
}

runDiagnostics().then(() => {
  console.log('\n✅ Diagnostics complete');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Diagnostic error:', error);
  process.exit(1);
});
