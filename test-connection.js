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
    console.log('🔄 Testing connection to baleeed5_wellness...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const result = await client.query('SELECT current_database()');
    console.log('📊 Current database:', result.rows[0]);
    
    await client.end();
    console.log('✅ Connection test passed!');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

test();
