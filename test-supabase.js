const { Client } = require('pg');

async function testConnection() {
  // Test with postgres database
  const client = new Client({
    host: 'aws-0-ap-south-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.lnvvaeudhtazvxtmifeg',
    password: 'Wellness@12345',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Connecting to postgres database...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const dbResult = await client.query('SELECT current_database()');
    console.log('📊 Current database:', dbResult.rows[0].current_database);
    
    const schemaResult = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema')");
    console.log('📂 Available schemas:', schemaResult.rows);
    
    const tablesResult = await client.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log('📋 Tables in public schema:', tablesResult.rows.slice(0, 10));
    
    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testConnection();
