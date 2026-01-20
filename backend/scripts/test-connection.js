/**
 * Test Supabase Connection
 * 
 * Test different password encoding methods
 */

import pg from 'pg';
const { Pool } = pg;

const password = 'Wellness@123#@';

console.log('Testing Supabase connection with different configurations...\n');

// Test 1: Direct password
async function test1() {
  console.log('Test 1: Direct password');
  const pool = new Pool({
    host: 'db.lnvvaeudhtazvxtmifeg.supabase.co',
    user: 'postgres',
    password: password,
    database: 'postgres',
    port: 5432,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Test 1: SUCCESS\n');
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    console.log('❌ Test 1: FAILED');
    console.log('   Error:', error.message, '\n');
    await pool.end();
    return false;
  }
}

// Test 2: Connection string with encoded password
async function test2() {
  console.log('Test 2: Connection string with URL-encoded password');
  const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.lnvvaeudhtazvxtmifeg.supabase.co:5432/postgres`;
  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Test 2: SUCCESS\n');
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    console.log('❌ Test 2: FAILED');
    console.log('   Error:', error.message, '\n');
    await pool.end();
    return false;
  }
}

// Test 3: Check if Supabase pooler is needed
async function test3() {
  console.log('Test 3: Using Supabase pooler (6543)');
  const pool = new Pool({
    host: 'db.lnvvaeudhtazvxtmifeg.supabase.co',
    user: 'postgres',
    password: password,
    database: 'postgres',
    port: 6543, // Supabase transaction pooler
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Test 3: SUCCESS\n');
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    console.log('❌ Test 3: FAILED');
    console.log('   Error:', error.message, '\n');
    await pool.end();
    return false;
  }
}

// Run tests
(async () => {
  console.log('Password being tested:', password);
  console.log('URL-encoded password:', encodeURIComponent(password));
  console.log('═══════════════════════════════════════════\n');
  
  const result1 = await test1();
  if (result1) {
    console.log('✅ Connection successful with direct password!');
    return;
  }
  
  const result2 = await test2();
  if (result2) {
    console.log('✅ Connection successful with connection string!');
    return;
  }
  
  const result3 = await test3();
  if (result3) {
    console.log('✅ Connection successful with pooler port!');
    return;
  }
  
  console.log('\n❌ All tests failed. Please verify:');
  console.log('   1. The password is correct');
  console.log('   2. The Supabase project is active');
  console.log('   3. Your IP is allowed in Supabase (check Connection Pooling settings)');
})();
