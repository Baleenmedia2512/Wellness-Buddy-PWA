const { Client } = require('pg');

async function test() {
  const client = new Client({
    host: 'db.lnvvaeudhtazvxtmifeg.supabase.co',
    port: 5432,
    user: 'postgres',
    password: 'Wellness@123#@',
    database: 'baleeed5_wellness',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connection successful!');
    
    const dbResult = await client.query('SELECT current_database()');
    console.log('📊 Current database:', dbResult.rows[0].current_database);
    
    const tablesResult = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 5");
    console.log('📋 Sample tables:', tablesResult.rows.map(r => r.table_name));
    
    await client.end();
    console.log('✅ All tests PASSED!');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

test();
